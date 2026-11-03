// Safety review: a starter evaluator action for Wanaku that acts on an LLM
// classification.
//
// The llm engine asks a model to classify each tools/call and passes the
// answer to the action as ctx.llmResult:
// {"level": "green|yellow|red", "reason": "..."}. The action passes green,
// warns on yellow, blocks red, and rejects any other result as malformed.
// Change decide() to act on your own levels. Keep the action in one file:
// jco componentizes a single module.

import { block, pass, rejectMalformed, warn } from 'wanaku:evaluator/response';
import { verifyLlmResult } from 'wanaku:evaluator/validation';
import { warn as logWarn } from 'wanaku:evaluator/log';

// The policy. It returns { action, reason }, where action is pass, warn,
// block or malformed.
export function decide(llmResult) {
  let classification;
  try {
    classification = JSON.parse(llmResult);
  } catch {
    return { action: 'malformed', reason: 'unrecognized_classification' };
  }
  const reason = classification?.reason ?? '';
  switch (classification?.level) {
    case 'green':
      return { action: 'pass' };
    case 'yellow':
      return { action: 'warn', reason: `safety_warning: ${reason}` };
    case 'red':
      return { action: 'block', reason: `safety_blocked: ${reason}` };
    default:
      return { action: 'malformed', reason: `unknown_level: ${classification?.level}` };
  }
}

export function evaluate(ctx) {
  // Check the model output against the evaluator's result_schema. Without a
  // schema, the host returns the output unchanged. A failed check throws.
  let result;
  try {
    result = verifyLlmResult(ctx.llmResult);
  } catch (error) {
    rejectMalformed(`invalid_classification: ${error.payload ?? error.message}`);
    return;
  }
  const decision = decide(result);
  switch (decision.action) {
    case 'pass':
      pass();
      break;
    case 'warn':
      logWarn(`safety review warning: ${decision.reason}`);
      warn(decision.reason);
      break;
    case 'block':
      logWarn(`safety review blocked the call: ${decision.reason}`);
      block(decision.reason);
      break;
    default:
      rejectMalformed(decision.reason);
  }
}

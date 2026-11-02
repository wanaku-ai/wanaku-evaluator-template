// Argument guard: a starter evaluator action for Wanaku.
//
// The action blocks a tools/call request when the tool is on a block list,
// or when an argument contains forbidden text. It passes all other requests.
// Edit BLOCKED_TOOLS and FORBIDDEN_TEXT, or replace decide() with your own
// rules. Keep the action in one file: jco componentizes a single module.

import { block, pass } from 'wanaku:evaluator/response';
import { warn as logWarn } from 'wanaku:evaluator/log';

// Tools that the policy always blocks.
const BLOCKED_TOOLS = ['delete_database'];

// Text that must not occur in a tool argument. The match ignores case.
const FORBIDDEN_TEXT = ['rm -rf', 'drop table'];

// The policy. It returns null to allow, or a deny reason.
export function decide(toolName, args) {
  if (!toolName) {
    return null;
  }
  if (BLOCKED_TOOLS.includes(toolName)) {
    return `tool_blocked: ${toolName}`;
  }
  for (const [name, value] of args) {
    const lower = value.toLowerCase();
    if (FORBIDDEN_TEXT.some((text) => lower.includes(text))) {
      return `forbidden_argument: ${name}`;
    }
  }
  return null;
}

export function evaluate(ctx) {
  const reason = decide(ctx.toolName, ctx.arguments);
  if (reason === null) {
    pass();
    return;
  }
  logWarn(`argument guard denied the call: ${reason}`);
  block(reason);
}

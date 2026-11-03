import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { decide, evaluate } from '../src/action.js';
import { calls, setVerifyLlmResult } from './host-stub.js';

const context = (llmResult) => ({
  method: 'tools/call',
  namespace: 'default',
  toolName: 'run_sql',
  arguments: [],
  llmResult,
});

beforeEach(() => {
  calls.length = 0;
  setVerifyLlmResult((raw) => raw);
});

test('passes green', () => {
  evaluate(context('{"level": "green", "reason": "read-only"}'));
  assert.deepEqual(calls, [['pass']]);
});

test('warns on yellow', () => {
  evaluate(context('{"level": "yellow", "reason": "writes a file"}'));
  assert.deepEqual(calls.at(-1), ['warn', 'safety_warning: writes a file']);
});

test('blocks red', () => {
  evaluate(context('{"level": "red", "reason": "drops a table"}'));
  assert.deepEqual(calls.at(-1), ['block', 'safety_blocked: drops a table']);
});

test('rejects an unknown level', () => {
  assert.deepEqual(decide('{"level": "purple"}'), {
    action: 'malformed',
    reason: 'unknown_level: purple',
  });
});

test('rejects output that is not a classification', () => {
  evaluate(context('I think this call is fine'));
  assert.deepEqual(calls, [['rejectMalformed', 'unrecognized_classification']]);
});

test('rejects output that fails the result schema', () => {
  setVerifyLlmResult(() => {
    throw Object.assign(new Error('schema'), { payload: 'missing level' });
  });
  evaluate(context('{}'));
  assert.deepEqual(calls, [['rejectMalformed', 'invalid_classification: missing level']]);
});

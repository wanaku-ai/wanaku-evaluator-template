import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { decide, evaluate } from '../src/action.js';
import { calls } from './host-stub.js';

const context = (toolName, args) => ({
  method: 'tools/call',
  namespace: 'default',
  toolName,
  arguments: args,
  llmResult: '',
});

beforeEach(() => {
  calls.length = 0;
});

test('allows a safe call', () => {
  evaluate(context('run_sql', [['query', 'SELECT * FROM orders']]));
  assert.deepEqual(calls, [['pass']]);
});

test('blocks a blocked tool', () => {
  evaluate(context('delete_database', []));
  assert.deepEqual(calls.at(-1), ['block', 'tool_blocked: delete_database']);
});

test('blocks forbidden text in any case', () => {
  evaluate(context('run_sql', [['limit', '10'], ['query', 'Drop Table orders']]));
  assert.deepEqual(calls.at(-1), ['block', 'forbidden_argument: query']);
});

test('allows a request without a tool', () => {
  assert.equal(decide(undefined, []), null);
});

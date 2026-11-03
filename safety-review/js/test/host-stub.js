// Records the calls that an action makes to the wanaku:evaluator/* host
// functions, so that the tests can check them without a WASM runtime.
export const calls = [];

const record = (name) => (...args) => {
  calls.push([name, ...args]);
};

export const pass = record('pass');
export const block = record('block');
export const rejectMalformed = record('rejectMalformed');
export const warn = record('warn');
export const filterTools = record('filterTools');
export const setMetadata = record('setMetadata');
export const info = record('info');
export const error = record('error');

// Validation returns its input, as the host does when no result_schema is
// declared. A test can replace it to simulate a schema failure.
export let verifyLlmResult = (raw) => raw;
export const setVerifyLlmResult = (fn) => {
  verifyLlmResult = fn;
};

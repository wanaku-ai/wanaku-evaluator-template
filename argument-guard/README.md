# Argument guard

The argument guard applies to `tools/call` requests:

- It blocks a call to a tool on the block list (`delete_database`).
- It blocks a call when an argument contains forbidden text (`rm -rf`, `drop table`). The match ignores case.
- It passes all other calls.

Edit the lists to change the policy. The lists are at the top of `rust/src/lib.rs` and `js/src/action.js`, and in `opa/data.json`.

The policy is written three times. Keep the folder for the language that you want and delete the others:

| Folder | Language | Runs as |
|---|---|---|
| [`rust/`](rust/) | Rust | Your own WASM action, with the `passthrough` engine |
| [`js/`](js/) | JavaScript | Your own WASM action, with the `passthrough` engine |
| [`opa/`](opa/) | Rego | An Open Policy Agent policy, with the `opa` engine and the bundled `opa_allow_action.wasm` |

Run the commands below from the repository root.

## Rust

Build and test the action:

```bash
cd argument-guard/rust
cargo component build --release --target wasm32-unknown-unknown
cargo test
mkdir -p ../../dist
cp target/wasm32-unknown-unknown/release/argument_guard_action.wasm ../../dist/argument_guard_rust.wasm
```

Install the tools first, as described in [Prerequisites](../README.md#prerequisites). Build for `wasm32-unknown-unknown`, not `wasm32-wasip1`. A `wasm32-wasip1` component imports WASI interfaces such as the file system, and policy simulation rejects it with `evaluator_processor_capability_unsupported`.

Use `cargo component build`, not `cargo build`. `cargo component build` generates `src/bindings.rs` from the WIT file. The repository does not include this file. If you run `cargo build`, `cargo test`, or `cargo clippy` before `cargo component build`, the compiler reports this error:

```text
error[E0583]: file not found for module `bindings`
```

To correct the error, run `cargo component build --release --target wasm32-unknown-unknown` one time. Then `cargo test` and `cargo clippy` work. Run `cargo component build` again after you change the WIT file.

The policy is the `decide` function in `rust/src/lib.rs`. It uses only plain data, so the unit tests do not need a WASM runtime. The `evaluate` function calls `decide` and sends the result to Wanaku.

## JavaScript

Build and test the action:

```bash
cd argument-guard/js
npm ci
npm test
npm run build
```

The build writes `argument_guard_js.wasm` to `dist/` at the repository root. The policy is the `decide` function in `js/src/action.js`. Keep the action in one file, because `jco componentize` reads a single module.

The tests replace the `wanaku:evaluator/*` host modules with `js/test/host-stub.js`. The stub records each host call, so a test can check that the action calls `pass()` or `block()`.

`js/jsconfig.json` points your editor at `wit/wanaku-actions.d.ts`, which describes the host API.

## Rego

Install [OPA](https://www.openpolicyagent.org/docs/latest/#running-opa). Then test the policy:

```bash
opa test argument-guard/opa/ -v
```

Start OPA with the policy and its data:

```bash
opa run --server --addr 127.0.0.1:8181 argument-guard/opa/policy.rego argument-guard/opa/data.json
```

`opa/wanaku.yaml` connects Wanaku to OPA. The evaluator queries `wanaku/argument_guard/decision`. The bundled `opa_allow_action.wasm` passes the call only when the decision is `"allow": true`. You do not build a WASM action for this variant.

For a full walkthrough, see [Gate tool calls with OPA](https://github.com/wanaku-ai/wanaku/blob/main/docs/govern/gate-calls-with-opa.md).

## Run the action in Wanaku

`wanaku.yaml` in this folder adds the Rust action as an evaluator. To use the JavaScript action, change `processor.path` to `argument_guard_js.wasm`.

Run these commands from the repository root. Mount the built actions on `/data/evaluators-custom/`. Do not mount a volume on `/data`, because it hides the bundled evaluators in `/data/evaluators/`.

```bash
podman run --rm -p 8080:8080 -p 8081:8081 \
  -v "$PWD/dist:/data/evaluators-custom:ro,Z" \
  -v "$PWD/argument-guard/wanaku.yaml:/etc/wanaku/wanaku.yaml:ro,Z" \
  quay.io/wanaku/wanaku-server:early-access
```

Run the smoke test against the server:

```bash
scripts/smoke-test.sh /data/evaluators-custom/argument_guard_rust.wasm
```

The smoke test uses the [policy simulation API](https://github.com/wanaku-ai/wanaku/blob/main/docs/govern/policy-simulation.md). It sends three `tools/call` requests with the action as the only evaluator, and it checks the decision for each request. Simulation does not call an MCP server. It does not change the active configuration. Add your own cases to the `expect` lines at the end of the script.

To protect a real MCP server, add it to the `forwards` section of `argument-guard/wanaku.yaml`.

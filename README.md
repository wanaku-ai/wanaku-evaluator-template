# Wanaku evaluator template

Start here to write your own [Wanaku](https://github.com/wanaku-ai/wanaku) policy. Wanaku evaluators decide whether an agent's tool call goes through, and this template gives you a working policy to copy and change, with tests and a CI pipeline that checks it in a real Wanaku server.

The template contains the same starter policy, called *argument guard*, three times:

| Folder | Language | Runs as |
|---|---|---|
| [`rust/`](rust/) | Rust | Your own WASM action, with the `passthrough` engine |
| [`js/`](js/) | JavaScript | Your own WASM action, with the `passthrough` engine |
| [`opa/`](opa/) | Rego | An Open Policy Agent policy, with the `opa` engine and the bundled `opa_allow_action.wasm` |

Keep the folder for the language that you want and delete the others.

The [`safety-review/`](safety-review/) folder shows a second kind of policy: an LLM reviews each tool call. It uses the bundled `safety_review_action.wasm`, so you write a prompt instead of code. See [Review calls with an LLM](#review-calls-with-an-llm).

## The starter policy

The argument guard applies to `tools/call` requests:

- It blocks a call to a tool on the block list (`delete_database`).
- It blocks a call when an argument contains forbidden text (`rm -rf`, `drop table`). The match ignores case.
- It passes all other calls.

Edit the lists to change the policy. The lists are at the top of `rust/src/lib.rs` and `js/src/action.js`, and in `opa/data.json`.

## Use the template

1. Select **Use this template** on GitHub to create your repository.
2. Clone your repository.
3. Delete the folders that you do not need. Remove their jobs from `.github/workflows/ci.yml`.
4. Change the policy and its tests.
5. Push your changes. CI builds the action, runs the tests, and runs the action in a Wanaku server.

## Write the policy in Rust

Install the tools:

```bash
rustup target add wasm32-unknown-unknown
cargo install cargo-component --version 0.21.1 --locked
```

Build and test the action:

```bash
cd rust
cargo component build --release --target wasm32-unknown-unknown
cargo test
mkdir -p ../dist
cp target/wasm32-unknown-unknown/release/argument_guard_action.wasm ../dist/argument_guard_rust.wasm
```

Build for `wasm32-unknown-unknown`, not `wasm32-wasip1`. A `wasm32-wasip1` component imports WASI interfaces such as the file system, and policy simulation rejects it with `evaluator_processor_capability_unsupported`.

Use `cargo component build`, not `cargo build`. `cargo component build` generates `src/bindings.rs` from the WIT file. The repository does not include this file. If you run `cargo build`, `cargo test`, or `cargo clippy` before `cargo component build`, the compiler reports this error:

```text
error[E0583]: file not found for module `bindings`
```

To correct the error, run `cargo component build --release --target wasm32-unknown-unknown` one time. Then `cargo test` and `cargo clippy` work. Run `cargo component build` again after you change the WIT file.

The policy is the `decide` function in `rust/src/lib.rs`. It uses only plain data, so the unit tests do not need a WASM runtime. The `evaluate` function calls `decide` and sends the result to Wanaku.

## Write the policy in JavaScript

Install Node.js 22 or later. Then build and test the action:

```bash
cd js
npm ci
npm test
npm run build
```

The build writes `dist/argument_guard_js.wasm`. The policy is the `decide` function in `js/src/action.js`. Keep the action in one file, because `jco componentize` reads a single module.

The tests replace the `wanaku:evaluator/*` host modules with `js/test/host-stub.js`. The stub records each host call, so a test can check that the action calls `pass()` or `block()`.

`js/wanaku-actions.d.ts` describes the host API for your editor.

## Write the policy in Rego

Install [OPA](https://www.openpolicyagent.org/docs/latest/#running-opa). Then test the policy:

```bash
opa test opa/ -v
```

Start OPA with the policy and its data:

```bash
opa run --server --addr 127.0.0.1:8181 opa/policy.rego opa/data.json
```

`opa/wanaku.yaml` connects Wanaku to OPA. The evaluator queries `wanaku/argument_guard/decision`. The bundled `opa_allow_action.wasm` passes the call only when the decision is `"allow": true`. You do not build a WASM action for this variant.

For a full walkthrough, see [Gate tool calls with OPA](https://github.com/wanaku-ai/wanaku/blob/main/docs/govern/gate-calls-with-opa.md).

## Review calls with an LLM

`safety-review/wanaku.yaml` adds an evaluator with the `llm` engine and the `classify` operation. For each `tools/call`, Wanaku sends the tool name, the arguments, and recent conversation history to the model with the prompt. The model returns a classification:

```json
{"level": "red", "reason": "deletes a production database"}
```

The bundled `/data/evaluators/safety_review_action.wasm` acts on the classification:

| Level | Decision |
|---|---|
| `green` | Pass the call. |
| `yellow` | Pass the call and record a warning. |
| `red` | Block the call. |
| Any other result | Reject the call as malformed. |

The `result_schema` makes Wanaku validate the model output before the action runs. If the output does not match, Wanaku retries one time with a correction prompt.

The example uses a local [Ollama](https://ollama.com) with the `llama3.2` model. To use a different model, change the `llm_connections` entry. Any OpenAI-compatible endpoint works. Set `api_key` if the endpoint needs one. You do not build a WASM action for this variant. To change what the review considers dangerous, edit the `prompt`.

Start Ollama and the server:

```bash
ollama pull llama3.2
ollama serve
podman run --rm -p 8080:8080 -p 8081:8081 \
  -v "$PWD/safety-review/wanaku.yaml:/etc/wanaku/wanaku.yaml:ro,Z" \
  quay.io/wanaku/wanaku-server:early-access
```

Check that the server loaded the evaluator:

```bash
scripts/check-config.sh
```

Policy simulation does not call LLMs, so `scripts/smoke-test.sh` cannot test this variant. CI runs `scripts/check-config.sh` instead. To see real decisions, add an MCP server to `forwards` and send tool calls through Wanaku on port 8081.

To write your own action for the model output, start from `rust/` or `js/` and read the classification from `ctx.llm_result` (Rust) or `ctx.llmResult` (JavaScript).

## Run the action in Wanaku

`config/wanaku.yaml` adds the Rust action as an evaluator. To use the JavaScript action, change `processor.path` to `argument_guard_js.wasm`.

Mount the built actions on `/data/evaluators-custom/`. Do not mount a volume on `/data`, because it hides the bundled evaluators in `/data/evaluators/`.

```bash
podman run --rm -p 8080:8080 -p 8081:8081 \
  -v "$PWD/dist:/data/evaluators-custom:ro,Z" \
  -v "$PWD/config/wanaku.yaml:/etc/wanaku/wanaku.yaml:ro,Z" \
  quay.io/wanaku/wanaku-server:early-access
```

Run the smoke test against the server:

```bash
scripts/smoke-test.sh /data/evaluators-custom/argument_guard_rust.wasm
```

The smoke test uses the [policy simulation API](https://github.com/wanaku-ai/wanaku/blob/main/docs/govern/policy-simulation.md). It sends three `tools/call` requests with the action as the only evaluator, and it checks the decision for each request. Simulation does not call an MCP server. It does not change the active configuration. Add your own cases to the `expect` lines at the end of the script.

To protect a real MCP server, add it to the `forwards` section of `config/wanaku.yaml`.

## Match the Wanaku version

Build your action against the WIT contract of the Wanaku version that runs it. `wit/WANAKU_VERSION` shows the release of the current contract. To update the contract:

```bash
scripts/sync-wit.sh <release-tag>
```

The script downloads `wanaku-evaluators-<version>.tar.gz` from the release. It updates `wit/evaluator.wit` and `js/wanaku-actions.d.ts`. Then set `WANAKU_IMAGE` in `.github/workflows/ci.yml` to the image of the same release.

This repository follows the Wanaku releases. The `Follow Wanaku release` workflow runs each day. When a Wanaku release ships an evaluator bundle, the workflow updates the contract and the CI image, commits the change to `main`, and pushes a tag with the same version. CI then publishes the starter actions for that tag. To run the workflow at once, start it from the **Actions** tab. You can give a release tag as input.

Your copy of the template gets the workflow too. Delete `.github/workflows/follow-wanaku-release.yml` if you do not want automatic updates.

## Publish the action

Push a tag that starts with `v`, for example `v0.1.0`. CI attaches the built `.wasm` files to a GitHub release.

## Learn more

- [Evaluators](https://github.com/wanaku-ai/wanaku/blob/main/docs/govern/evaluators.md): configuration, error policy, and resource limits.
- [Evaluator engines](https://github.com/wanaku-ai/wanaku/blob/main/docs/govern/evaluator-engines.md): `passthrough`, `llm`, `opa`, and TypeSafe System One.
- [Write evaluator actions in Rust](https://github.com/wanaku-ai/wanaku/blob/main/docs/extend/evaluator-actions-rust.md) and [in JavaScript](https://github.com/wanaku-ai/wanaku/blob/main/docs/extend/evaluator-actions-js.md): the host API and more examples.

## License

Apache License 2.0. See [LICENSE](LICENSE).

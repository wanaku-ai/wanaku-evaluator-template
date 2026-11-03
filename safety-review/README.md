# Safety review

The safety review is an LLM policy. A model reviews each tool call, and a WASM action acts on its answer:

| Folder | Language | Runs as |
|---|---|---|
| [`rust/`](rust/) | Rust | Your own WASM action, with the `llm` engine |
| [`js/`](js/) | JavaScript | Your own WASM action, with the `llm` engine |

Run the commands below from the repository root.

`safety-review/wanaku.yaml` adds an evaluator with the `llm` engine and the `classify` operation. For each `tools/call`, Wanaku sends the tool name, the arguments, and recent conversation history to the model with the prompt. The model returns a classification:

```json
{"level": "red", "reason": "deletes a production database"}
```

The safety review action reads the classification from `ctx.llm_result` (Rust) or `ctx.llmResult` (JavaScript). First it calls `verify_llm_result` (`verifyLlmResult` in JavaScript) to check the output against the evaluator's `result_schema`. Then it acts on the level:

| Level | Decision |
|---|---|
| `green` | Pass the call. |
| `yellow` | Pass the call and record a warning. |
| `red` | Block the call. |
| Any other result | Reject the call as malformed. |

The policy is the `decide` function in `safety-review/rust/src/lib.rs` and `safety-review/js/src/action.js`. Change it to act on your own levels. To change what the model considers dangerous, edit the `prompt` in `safety-review/wanaku.yaml`. If you only want to change the prompt, set `processor.path` to the bundled `/data/evaluators/safety_review_action.wasm`. That action has the same behavior, and you do not need to build anything.

Install the tools first, as described in [Prerequisites](../README.md#prerequisites). Then build and test the actions:

```bash
cd safety-review/rust
cargo component build --release --target wasm32-unknown-unknown
cargo test
mkdir -p ../../dist
cp target/wasm32-unknown-unknown/release/safety_review_action.wasm ../../dist/safety_review_rust.wasm

cd ../js
npm ci
npm test
npm run build
```

The JavaScript build writes `safety_review_js.wasm` to `dist/` at the repository root. `safety-review/wanaku.yaml` uses the Rust action. To use the JavaScript action, change `processor.path` to `safety_review_js.wasm`.

The example uses a local [Ollama](https://ollama.com) with the `llama3.2` model. To use a different model, change the `llm_connections` entry. Any OpenAI-compatible endpoint works. Set `api_key` if the endpoint needs one.

Start Ollama and the server:

```bash
ollama pull llama3.2
ollama serve
podman run --rm -p 8080:8080 -p 8081:8081 \
  -v "$PWD/dist:/data/evaluators-custom:ro,Z" \
  -v "$PWD/safety-review/wanaku.yaml:/etc/wanaku/wanaku.yaml:ro,Z" \
  quay.io/wanaku/wanaku-server:early-access
```

Check that the server loaded the evaluator:

```bash
scripts/check-config.sh
```

Policy simulation does not call LLMs, so `scripts/smoke-test.sh` cannot test this variant. The unit tests cover the policy with fixed model outputs. CI also runs `scripts/check-config.sh` for each action, which checks that the server accepts the configuration and compiles the action. To see real decisions, add an MCP server to `forwards` and send tool calls through Wanaku on port 8081.

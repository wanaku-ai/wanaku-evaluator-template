# Wanaku evaluator template

Start here to write your own [Wanaku](https://github.com/wanaku-ai/wanaku) policy. Wanaku evaluators decide whether an agent's tool call goes through, and this template gives you working policies to copy and change, with tests and a CI pipeline that checks them in a real Wanaku server.

## What is in the template

```text
argument-guard/     A rule-based policy: block tools and forbidden argument text
  rust/  js/  opa/  The same policy in Rust, JavaScript, and Rego
  wanaku.yaml       Wanaku configuration for the Rust and JavaScript actions
safety-review/      An LLM policy: a model classifies each call as green, yellow, or red
  rust/  js/        The action that acts on the classification
  wanaku.yaml       Wanaku configuration with the llm engine
wit/                The Wanaku evaluator contract (WIT) and the JavaScript typings
scripts/            Smoke test, configuration check, and contract update
```

Each policy folder has a README with build, test, and run instructions:

- [Argument guard](argument-guard/README.md): start here for rules that you can write in code.
- [Safety review](safety-review/README.md): start here to let an LLM review the calls.

## Use the template

1. Select **Use this template** on GitHub to create your repository.
2. Clone your repository.
3. Delete the policies and languages that you do not need. Remove their jobs from `.github/workflows/ci.yml`.
4. Change the policy and its tests.
5. Push your changes. CI builds the actions, runs the tests, and checks the actions in a Wanaku server.

## Prerequisites

For the Rust actions, install the WASM target and `cargo-component`:

```bash
rustup target add wasm32-unknown-unknown
cargo install cargo-component --version 0.21.1 --locked
```

For the JavaScript actions, install Node.js 22 or later. For the Rego policy, install [OPA](https://www.openpolicyagent.org/docs/latest/#running-opa). To run the actions, install Podman or Docker.

Each build writes its `.wasm` file to `dist/` at the repository root. Mount `dist/` on `/data/evaluators-custom/` in the Wanaku container.

## Match the Wanaku version

Build your action against the WIT contract of the Wanaku version that runs it. `wit/WANAKU_VERSION` shows the release of the current contract. To update the contract:

```bash
scripts/sync-wit.sh <release-tag>
```

The script downloads `wanaku-evaluators-<version>.tar.gz` from the release. It updates `wit/evaluator.wit`, `wit/wanaku-actions.d.ts`, and `wit/WANAKU_VERSION`. CI runs the Wanaku image that has the same version as `wit/WANAKU_VERSION`.

This repository follows the Wanaku releases. The `Follow Wanaku release` workflow runs each day. When a Wanaku release ships an evaluator bundle, the workflow updates the contract and the image in the READMEs, commits the change to `main`, and pushes a tag with the same version. CI then publishes the starter actions for that tag. To run the workflow at once, start it from the **Actions** tab. You can give a release tag as input.

Your copy of the template gets the workflow too. Delete `.github/workflows/follow-wanaku-release.yml` if you do not want automatic updates.

## Publish the action

Push a tag that starts with `v`, for example `v0.1.0`. CI attaches the built `.wasm` files to a GitHub release.

## Learn more

- [Evaluators](https://github.com/wanaku-ai/wanaku/blob/main/docs/govern/evaluators.md): configuration, error policy, and resource limits.
- [Evaluator engines](https://github.com/wanaku-ai/wanaku/blob/main/docs/govern/evaluator-engines.md): `passthrough`, `llm`, `opa`, and TypeSafe System One.
- [Write evaluator actions in Rust](https://github.com/wanaku-ai/wanaku/blob/main/docs/extend/evaluator-actions-rust.md) and [in JavaScript](https://github.com/wanaku-ai/wanaku/blob/main/docs/extend/evaluator-actions-js.md): the host API and more examples.

## License

Apache License 2.0. See [LICENSE](LICENSE).

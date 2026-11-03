//! Argument guard: a starter evaluator action for Wanaku.
//!
//! The action blocks a `tools/call` request when the tool is on a block list,
//! or when an argument contains forbidden text. It passes all other requests.
//! Edit `BLOCKED_TOOLS` and `FORBIDDEN_TEXT`, or replace `decide` with your
//! own rules.
//!
//! Build with `cargo component build --release --target wasm32-unknown-unknown`.
//! That command generates `src/bindings.rs` from the WIT file. A plain
//! `cargo build` fails until the file exists.

#[allow(warnings)]
#[rustfmt::skip]
mod bindings;

use bindings::Guest;
use bindings::wanaku::evaluator::types::EvaluationContext;
use bindings::wanaku::evaluator::{log, response};

/// Tools that the policy always blocks.
const BLOCKED_TOOLS: &[&str] = &["delete_database"];

/// Text that must not occur in a tool argument. The match ignores case.
const FORBIDDEN_TEXT: &[&str] = &["rm -rf", "drop table"];

struct ArgumentGuard;

impl Guest for ArgumentGuard {
    fn evaluate(ctx: EvaluationContext) {
        match decide(ctx.tool_name.as_deref(), &ctx.arguments) {
            Decision::Allow => response::pass(),
            Decision::Deny(reason) => {
                log::warn(&format!("argument guard denied the call: {reason}"));
                response::block(&reason);
            }
        }
    }
}

#[derive(Debug, PartialEq)]
enum Decision {
    Allow,
    Deny(String),
}

/// The policy. It uses only plain data, so the unit tests can call it
/// without a WASM runtime.
fn decide(tool_name: Option<&str>, arguments: &[(String, String)]) -> Decision {
    let Some(tool_name) = tool_name else {
        return Decision::Allow;
    };
    if BLOCKED_TOOLS.contains(&tool_name) {
        return Decision::Deny(format!("tool_blocked: {tool_name}"));
    }
    for (name, value) in arguments {
        let value = value.to_lowercase();
        if FORBIDDEN_TEXT.iter().any(|text| value.contains(text)) {
            return Decision::Deny(format!("forbidden_argument: {name}"));
        }
    }
    Decision::Allow
}

bindings::export!(ArgumentGuard with_types_in bindings);

#[cfg(test)]
mod tests {
    use super::{Decision, decide};

    fn args(pairs: &[(&str, &str)]) -> Vec<(String, String)> {
        pairs
            .iter()
            .map(|(name, value)| (name.to_string(), value.to_string()))
            .collect()
    }

    #[test]
    fn allows_a_safe_call() {
        let arguments = args(&[("query", "SELECT * FROM orders")]);
        assert_eq!(decide(Some("run_sql"), &arguments), Decision::Allow);
    }

    #[test]
    fn blocks_a_blocked_tool() {
        assert_eq!(
            decide(Some("delete_database"), &[]),
            Decision::Deny("tool_blocked: delete_database".to_string())
        );
    }

    #[test]
    fn blocks_forbidden_text_in_any_case() {
        let arguments = args(&[("limit", "10"), ("query", "Drop Table orders")]);
        assert_eq!(
            decide(Some("run_sql"), &arguments),
            Decision::Deny("forbidden_argument: query".to_string())
        );
    }

    #[test]
    fn allows_a_request_without_a_tool() {
        assert_eq!(decide(None, &[]), Decision::Allow);
    }
}

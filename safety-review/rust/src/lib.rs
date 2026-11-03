//! Safety review: a starter evaluator action for Wanaku that acts on an LLM
//! classification.
//!
//! The `llm` engine asks a model to classify each `tools/call` and passes
//! the answer to the action as `ctx.llm_result`:
//! `{"level": "green|yellow|red", "reason": "..."}`. The action passes
//! green, warns on yellow, blocks red, and rejects any other result as
//! malformed. Change `decide` to act on your own levels.
//!
//! Build with `cargo component build --release --target wasm32-unknown-unknown`.
//! That command generates `src/bindings.rs` from the WIT file. A plain
//! `cargo build` fails until the file exists.

#[allow(warnings)]
#[rustfmt::skip]
mod bindings;

use bindings::Guest;
use bindings::wanaku::evaluator::types::EvaluationContext;
use bindings::wanaku::evaluator::{log, response, validation};
use serde::Deserialize;

struct SafetyReview;

impl Guest for SafetyReview {
    fn evaluate(ctx: EvaluationContext) {
        // Check the model output against the evaluator's result_schema.
        // Without a schema, the host returns the output unchanged.
        let result = match validation::verify_llm_result(&ctx.llm_result) {
            Ok(result) => result,
            Err(error) => {
                response::reject_malformed(&format!("invalid_classification: {error}"));
                return;
            }
        };
        match decide(&result) {
            Decision::Pass => response::pass(),
            Decision::Warn(reason) => {
                log::warn(&format!("safety review warning: {reason}"));
                response::warn(&reason);
            }
            Decision::Block(reason) => {
                log::warn(&format!("safety review blocked the call: {reason}"));
                response::block(&reason);
            }
            Decision::Malformed(reason) => response::reject_malformed(&reason),
        }
    }
}

/// The classification that the prompt asks the model to return.
#[derive(Deserialize)]
struct Classification {
    level: String,
    #[serde(default)]
    reason: String,
}

#[derive(Debug, PartialEq)]
enum Decision {
    Pass,
    Warn(String),
    Block(String),
    Malformed(String),
}

/// The policy. It uses only plain data, so the unit tests can call it
/// without a WASM runtime.
fn decide(llm_result: &str) -> Decision {
    let Ok(classification) = serde_json::from_str::<Classification>(llm_result) else {
        return Decision::Malformed("unrecognized_classification".to_string());
    };
    let reason = classification.reason;
    match classification.level.as_str() {
        "green" => Decision::Pass,
        "yellow" => Decision::Warn(format!("safety_warning: {reason}")),
        "red" => Decision::Block(format!("safety_blocked: {reason}")),
        level => Decision::Malformed(format!("unknown_level: {level}")),
    }
}

bindings::export!(SafetyReview with_types_in bindings);

#[cfg(test)]
mod tests {
    use super::{Decision, decide};

    #[test]
    fn passes_green() {
        assert_eq!(
            decide(r#"{"level": "green", "reason": "read-only"}"#),
            Decision::Pass
        );
    }

    #[test]
    fn warns_on_yellow() {
        assert_eq!(
            decide(r#"{"level": "yellow", "reason": "writes a file"}"#),
            Decision::Warn("safety_warning: writes a file".to_string())
        );
    }

    #[test]
    fn blocks_red() {
        assert_eq!(
            decide(r#"{"level": "red", "reason": "drops a table"}"#),
            Decision::Block("safety_blocked: drops a table".to_string())
        );
    }

    #[test]
    fn rejects_an_unknown_level() {
        assert_eq!(
            decide(r#"{"level": "purple"}"#),
            Decision::Malformed("unknown_level: purple".to_string())
        );
    }

    #[test]
    fn rejects_output_that_is_not_a_classification() {
        assert_eq!(
            decide("I think this call is fine"),
            Decision::Malformed("unrecognized_classification".to_string())
        );
    }
}

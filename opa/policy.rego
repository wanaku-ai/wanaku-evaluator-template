# Argument guard: a starter tool-call policy for the Wanaku OPA engine.
#
# The policy denies a tools/call request when the tool is on a block list,
# or when a string argument contains forbidden text. Edit data.json, or
# replace the deny_reasons rules with your own.
#
# Boolean decision:    POST /v1/data/wanaku/argument_guard/allow
# Structured decision: POST /v1/data/wanaku/argument_guard/decision
package wanaku.argument_guard

default allow := false

allow if count(deny_reasons) == 0

decision := {"allow": true, "reason": null} if allow

decision := {"allow": false, "reason": min(deny_reasons)} if not allow

deny_reasons contains "unsupported_input_version" if {
	input.version != "wanaku.opa.input/v1"
}

deny_reasons contains "unsupported_method" if {
	input.method != "tools/call"
}

deny_reasons contains "tool_blocked" if {
	input.tool_name in data.policy.blocked_tools
}

deny_reasons contains "forbidden_argument" if {
	some value in input.arguments
	is_string(value)
	some text in data.policy.forbidden_text
	contains(lower(value), text)
}

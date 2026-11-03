package wanaku.argument_guard_test

import data.wanaku.argument_guard

call(tool_name, arguments) := {
	"version": "wanaku.opa.input/v1",
	"method": "tools/call",
	"namespace": "default",
	"tool_name": tool_name,
	"arguments": arguments,
}

test_allows_a_safe_call if {
	argument_guard.decision == {"allow": true, "reason": null} with input as call("run_sql", {"query": "SELECT * FROM orders"})
}

test_denies_a_blocked_tool if {
	argument_guard.decision == {"allow": false, "reason": "tool_blocked"} with input as call("delete_database", {})
}

test_denies_forbidden_text_in_any_case if {
	argument_guard.decision.reason == "forbidden_argument" with input as call("run_sql", {"limit": 10, "query": "Drop Table orders"})
}

test_denies_other_methods if {
	argument_guard.decision.reason == "unsupported_method" with input as object.union(call("run_sql", {}), {"method": "prompts/get"})
}

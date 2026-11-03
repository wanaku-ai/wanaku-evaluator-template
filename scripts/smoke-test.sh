#!/usr/bin/env bash
# Runs a built action in a Wanaku server through the policy simulation API.
#
# Usage: scripts/smoke-test.sh <wasm-path-on-the-server> [management-url]
#
# The server must have a governance posture with `no_match: allow` for the
# `default` namespace, as in argument-guard/wanaku.yaml. Simulation does not call
# an upstream MCP server and does not change the active configuration.
set -euo pipefail

wasm="${1:?usage: smoke-test.sh <wasm-path-on-the-server> [management-url]}"
mgmt="${2:-http://localhost:8080}"

# Simulates one tools/call with the action as the only evaluator and prints
# the final decision: allow or deny.
simulate() {
    local tool="$1" arguments="$2"
    curl --fail-with-body -sS -X POST "$mgmt/api/v1/policy-simulations/simulate" \
        -H 'Content-Type: application/json' \
        -d @- <<EOF | jq -r '.data.decision'
{
  "candidate": {
    "base_policy_revision": 0,
    "inline_policy": {"rules": []},
    "base_evaluator_revision": 0,
    "inline_evaluators": [{
      "name": "argument-guard",
      "trigger": {"method": "tools/call"},
      "engine": {"type": "passthrough"},
      "processor": {"path": "$wasm"}
    }]
  },
  "action": {
    "namespace": "default",
    "request": {
      "jsonrpc": "2.0", "id": 1, "method": "tools/call",
      "params": {"name": "$tool", "arguments": $arguments}
    }
  }
}
EOF
}

failures=0
expect() {
    local expected="$1" tool="$2" arguments="$3" actual
    actual="$(simulate "$tool" "$arguments")"
    if [ "$actual" = "$expected" ]; then
        echo "ok   $tool $arguments -> $actual"
    else
        echo "FAIL $tool $arguments -> $actual (expected $expected)"
        failures=$((failures + 1))
    fi
}

for _ in $(seq 1 30); do
    curl -sf "$mgmt/healthz" > /dev/null && break
    sleep 1
done

expect allow run_sql '{"query": "SELECT * FROM orders"}'
expect deny run_sql '{"query": "Drop Table orders"}'
expect deny delete_database '{}'

[ "$failures" -eq 0 ]

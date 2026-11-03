#!/usr/bin/env bash
# Checks that a Wanaku server loaded its evaluator configuration.
#
# Usage: scripts/check-config.sh [management-url]
#
# The server validates the evaluators and compiles their processors at
# startup. The evaluator status is "ready" only when that succeeds. This
# check does not call the LLM.
set -euo pipefail

mgmt="${1:-http://localhost:8080}"

for _ in $(seq 1 120); do
    curl -sf "$mgmt/healthz" > /dev/null && break
    sleep 1
done

status="$(curl --fail-with-body -sS "$mgmt/api/v1/evaluators/status?namespace=default")"
state="$(jq -r '.data.state' <<< "$status")"
echo "evaluator state: $state"
if [ "$state" != "ready" ]; then
    jq . <<< "$status"
    exit 1
fi

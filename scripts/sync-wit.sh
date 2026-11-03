#!/usr/bin/env bash
# Updates wit/evaluator.wit and wit/wanaku-actions.d.ts from a Wanaku release.
#
# Usage: scripts/sync-wit.sh [release-tag]   (default: early-access)
#
# Build your action against the WIT file of the Wanaku version that runs it.
set -euo pipefail

tag="${1:-early-access}"
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

url="$(curl -sSf "https://api.github.com/repos/wanaku-ai/wanaku/releases/tags/$tag" |
    jq -r '.assets[] | select(.name | test("^wanaku-evaluators-.*\\.tar\\.gz$")) | .browser_download_url')"
if [ -z "$url" ]; then
    echo "release $tag has no wanaku-evaluators bundle" >&2
    exit 1
fi

curl -sSfL "$url" | tar xz -C "$work" --strip-components=1
install -m 0644 "$work/wit/evaluator.wit" "$root/wit/evaluator.wit"
install -m 0644 "$work/sdk/js/wanaku-actions.d.ts" "$root/wit/wanaku-actions.d.ts"
echo "$tag" > "$root/wit/WANAKU_VERSION"
echo "Updated the WIT contract from $(basename "$url") ($tag)."

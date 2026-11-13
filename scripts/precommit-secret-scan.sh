#!/usr/bin/env bash
# Pre-commit guard: refuse to commit anything that matches one of the
# SECRET-001 patterns the audit-core check looks for. Keeps us from
# shipping the exact mistake we point out on every other repo.
#
# Install: `ln -sf ../../scripts/precommit-secret-scan.sh .git/hooks/pre-commit`
# or copy the file. Hook returns non-zero to block the commit.

set -euo pipefail

staged() { git diff --cached --name-only --diff-filter=ACMR -- ':!bench/disclosures.md'; }

FILES=$(staged)
if [ -z "$FILES" ]; then
  exit 0
fi

PATTERNS=(
  # OpenAI
  'sk-[A-Za-z0-9]{20,}'
  'sk-proj-[A-Za-z0-9_-]{20,}'
  # Anthropic
  'sk-ant-[A-Za-z0-9_-]{20,}'
  # Stripe live
  'sk_live_[A-Za-z0-9]{24,}'
  'rk_live_[A-Za-z0-9]{24,}'
  # GitHub
  'ghp_[A-Za-z0-9]{36}'
  'ghs_[A-Za-z0-9]{36}'
  'github_pat_[A-Za-z0-9_]{80,}'
  # AWS
  'AKIA[0-9A-Z]{16}'
  # Slack
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  # Google API
  'AIza[0-9A-Za-z_-]{35}'
  # Private keys
  '-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----'
  # Reonic (internal)
  'rnc_v3_[a-f0-9_]{40,}'
)

HIT=0
for f in $FILES; do
  if [ ! -f "$f" ]; then continue; fi
  # skip binary files
  if ! grep -Iq . "$f"; then continue; fi
  for pat in "${PATTERNS[@]}"; do
    MATCH=$(grep -E -n "$pat" "$f" 2>/dev/null || true)
    if [ -n "$MATCH" ]; then
      echo "pre-commit: possible secret in $f:"
      echo "$MATCH" | head -3 | sed 's/^/    /'
      HIT=1
    fi
  done
done

if [ "$HIT" -ne 0 ]; then
  cat <<EOF

Commit blocked. If this is a real secret:
  1. Remove the value and rotate it.
  2. If it already landed in git history, scrub with: git filter-repo --invert-paths --path <file>

If this is a test fixture or false positive, bypass this hook once:
  git commit --no-verify -m "..."

EOF
  exit 1
fi

exit 0

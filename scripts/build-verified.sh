#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

echo "Running bounded vinext build..."

run_with_timeout() {
  local timeout_bin=""
  if command -v gtimeout >/dev/null 2>&1; then
    timeout_bin="gtimeout"
  elif command -v timeout >/dev/null 2>&1; then
    timeout_bin="timeout"
  fi

  if [[ -n "${timeout_bin}" ]]; then
    "${timeout_bin}" \
      --signal=TERM \
      --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
      "${SITES_BUILD_TIMEOUT:-3m}" \
      "$@"
    return
  fi

  python3 - "$@" <<'PY'
import os, signal, subprocess, sys

cmd = sys.argv[1:]
# Accept either a duration like "3m" or a raw number of seconds.
raw_timeout = os.environ.get("SITES_BUILD_TIMEOUT", "3m")
raw_kill_after = os.environ.get("SITES_BUILD_KILL_AFTER", "10s")

def parse_duration(value: str) -> int:
    value = value.strip()
    if value.endswith("ms"):
        return max(1, int(value[:-2]) // 1000)
    if value.endswith("s"):
        return max(1, int(value[:-1]))
    if value.endswith("m"):
        return max(1, int(value[:-1]) * 60)
    if value.endswith("h"):
        return max(1, int(value[:-1]) * 3600)
    return max(1, int(value))

try:
    timeout_seconds = parse_duration(raw_timeout)
    kill_after_seconds = parse_duration(raw_kill_after)
except ValueError:
    timeout_seconds = 180
    kill_after_seconds = 10

proc = subprocess.Popen(cmd, start_new_session=True)
try:
    try:
        proc.wait(timeout=timeout_seconds)
    except subprocess.TimeoutExpired:
        if proc.poll() is None:
            os.killpg(proc.pid, signal.SIGTERM)
        try:
            proc.wait(timeout=kill_after_seconds)
        except subprocess.TimeoutExpired:
            if proc.poll() is None:
                os.killpg(proc.pid, signal.SIGKILL)
            proc.wait(timeout=5)
        raise SystemExit(124)
except KeyboardInterrupt:
    if proc.poll() is None:
        os.killpg(proc.pid, signal.SIGTERM)
    raise

if proc.returncode != 0:
    raise SystemExit(proc.returncode)
PY
}

run_with_timeout "${vinext}" build

"${script_dir}/validate-artifact.sh"

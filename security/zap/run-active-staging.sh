#!/usr/bin/env bash
set -euo pipefail
target="${ZAP_STAGING_TARGET:-}"
output_dir="${1:-security/zap/reports}"
[[ -n "$target" ]] || { echo "Set ZAP_STAGING_TARGET to an isolated deploy-preview URL." >&2; exit 2; }
case "$target" in
  https://quantumnhr.com*|https://www.quantumnhr.com*) echo "Refusing active scan against production." >&2; exit 3 ;;
  https://*--quantumnartresources.netlify.app) ;;
  *) echo "Refusing scan: target is outside the authorized deploy-preview scope." >&2; exit 4 ;;
esac
mkdir -p "$output_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
html_name="zap-active-staging-${timestamp}.html"
json_name="zap-active-staging-${timestamp}.json"
if command -v docker >/dev/null 2>&1; then
  docker run --rm -t -v "$(cd "$output_dir" && pwd):/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
    zap-full-scan.py -t "$target" -m 3 -j -r "$html_name" -J "$json_name"
elif [[ -n "${ZAP_HOME:-}" && -x "${ZAP_HOME}/zap.sh" ]]; then
  plan="$(mktemp)"
  trap 'rm -f "$plan"' EXIT
  sed -e "s|__TARGET__|$target|g" -e "s|__OUTPUT_DIR__|$(cd "$output_dir" && pwd)|g" \
    -e "s|__HTML_REPORT__|$html_name|g" -e "s|__JSON_REPORT__|$json_name|g" \
    security/zap/automation-active-staging.yaml > "$plan"
  "${ZAP_HOME}/zap.sh" -cmd -autorun "$plan"
else
  echo "Install Docker or set ZAP_HOME to an OWASP ZAP installation." >&2
  exit 5
fi
echo "Authorized staging-only active scan completed."
echo "JSON: ${output_dir}/${json_name}"
echo "HTML: ${output_dir}/${html_name}"

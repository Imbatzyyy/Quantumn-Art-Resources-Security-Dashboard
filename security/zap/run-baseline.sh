#!/usr/bin/env bash
set -euo pipefail
target="${1:-https://quantumnhr.com}"
output_dir="${2:-security/zap/reports}"
case "$target" in
  https://quantumnhr.com|https://www.quantumnhr.com|https://*--quantumnartresources.netlify.app) ;;
  *) echo "Refusing scan: target is outside the authorized Quantum HRMS scope." >&2; exit 2 ;;
esac
mkdir -p "$output_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
html_name="zap-baseline-${timestamp}.html"
json_name="zap-baseline-${timestamp}.json"
if command -v docker >/dev/null 2>&1; then
  docker run --rm -t -v "$(cd "$output_dir" && pwd):/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
    zap-baseline.py -t "$target" -m 2 -j --auto -r "$html_name" -J "$json_name"
elif [[ -n "${ZAP_HOME:-}" && -x "${ZAP_HOME}/zap.sh" ]]; then
  plan="$(mktemp)"
  sed -e "s|__TARGET__|$target|g" -e "s|__OUTPUT_DIR__|$(cd "$output_dir" && pwd)|g" \
    -e "s|__HTML_REPORT__|$html_name|g" -e "s|__JSON_REPORT__|$json_name|g" \
    security/zap/automation-baseline.yaml > "$plan"
  "${ZAP_HOME}/zap.sh" -cmd -autorun "$plan"
  rm -f "$plan"
else
  echo "Install Docker or set ZAP_HOME to an OWASP ZAP installation." >&2; exit 3
fi
echo "Authorized passive baseline completed."
echo "JSON: ${output_dir}/${json_name}"
echo "HTML: ${output_dir}/${html_name}"

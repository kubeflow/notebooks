#!/usr/bin/env bash
# Drives the OIDC login flow like a browser and stores the session cookie in a jar.
# Usage: login.sh <gateway-host> <ca-file> <email> <password> <cookie-jar>
set -euo pipefail
H=$1 CA=$2 USER=$3 PASS=$4 JAR=$5
rm -f "$JAR"
c() { curl --cacert "$CA" -s -b "$JAR" -c "$JAR" --max-time 20 "$@"; }

# 1. oauth2-proxy starts the flow and redirects to Dex.
loc=$(c -o /dev/null -w '%{redirect_url}' "https://$H/oauth2/start?rd=%2Fworkspaces%2F")
echo "1. /oauth2/start -> ${loc:0:60}..."

# 2. Dex: with a single connector it redirects (twice) to the local login form.
form=$(c -L "$loc")
action=$(echo "$form" | grep -o 'action="[^"]*"' | head -1 | cut -d'"' -f2 | sed 's/&amp;/\&/g')
[[ "$action" == /* ]] && action="https://$H$action"
echo "2. login form action -> ${action:0:70}..."

# 3. Submit credentials; Dex answers with a redirect chain ending at the
#    oauth2-proxy callback, which sets the session cookie.
loc=$(c -o /dev/null -w '%{redirect_url}' --data-urlencode "login=$USER" --data-urlencode "password=$PASS" "$action")
n=0
while [[ -n "$loc" && $n -lt 6 ]]; do
  echo "   -> ${loc:0:90}"
  loc=$(c -o /dev/null -w '%{redirect_url}' "$loc")
  n=$((n+1))
done
grep -q _oauth2_proxy "$JAR" && echo "4. session cookie stored in $JAR" || { echo "no session cookie!"; exit 1; }

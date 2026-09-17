#!/usr/bin/env bash
# Points sacretrogame.club and www at Vercel through the Cloudflare API.
# Safe to re-run: existing records are updated in place.
#
#   CLOUDFLARE_API_TOKEN=... scripts/dns.sh [apex-ip] [www-target]
#
# The token needs Zone:DNS:Edit on the zone. Defaults are Vercel's general
# targets; pass the values from `vercel domains inspect` if they differ.
set -euo pipefail

ZONE_NAME="sacretrogame.club"
APEX_IP="${1:-76.76.21.21}"
WWW_TARGET="${2:-cname.vercel-dns.com}"
API="https://api.cloudflare.com/client/v4"
: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN}"

cf() { curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" "$@"; }

ZONE_ID="$(cf "$API/zones?name=$ZONE_NAME" | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"][0]["id"])')"

upsert() { # type name content
  local body existing
  # proxied=false: Vercel terminates TLS and needs to see traffic directly.
  body="$(printf '{"type":"%s","name":"%s","content":"%s","ttl":1,"proxied":false}' "$1" "$2" "$3")"
  existing="$(cf "$API/zones/$ZONE_ID/dns_records?name=$2" | python3 -c 'import sys,json; r=[x for x in json.load(sys.stdin)["result"] if x["type"] in ("A","AAAA","CNAME")]; print(r[0]["id"] if r else "")')"
  if [[ -n "$existing" ]]; then
    cf -X PUT "$API/zones/$ZONE_ID/dns_records/$existing" -d "$body" >/dev/null
    echo "updated $1 $2 -> $3"
  else
    cf -X POST "$API/zones/$ZONE_ID/dns_records" -d "$body" >/dev/null
    echo "created $1 $2 -> $3"
  fi
}

upsert A "$ZONE_NAME" "$APEX_IP"
upsert CNAME "www.$ZONE_NAME" "$WWW_TARGET"

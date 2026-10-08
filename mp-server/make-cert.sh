#!/usr/bin/env bash
# Makes the self-signed TLS certificate the LAN server needs. The portal is HTTPS, and
# Chrome refuses ws:// from an HTTPS page, so the socket has to be wss://.
#
#   bash mp-server/make-cert.sh            # this PC's IPv4 addresses and hostname
#   bash mp-server/make-cert.sh 172.16.3.9 # or name the address yourself
#
# Writes mp-server/certs/key.pem and cert.pem (git-ignored: the key is private).
# Each player opens https://<address>:7777 once and accepts the warning.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p certs

host=$(hostname)
ips=${1:-$(ipconfig | tr -d '\r' | sed -n 's/.*IPv4 Address[^:]*: *//p')}
san="DNS:localhost,IP:127.0.0.1,DNS:${host}"
for ip in $ips; do san="${san},IP:${ip}"; done

# MSYS would rewrite "/CN=..." into a Windows path.
MSYS2_ARG_CONV_EXCL='*' openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 397 \
    -keyout certs/key.pem -out certs/cert.pem \
    -subj "/CN=${host} pool server" \
    -addext "subjectAltName=${san}" \
    -addext "extendedKeyUsage=serverAuth" 2>/dev/null

echo "Certificate for: ${san}"

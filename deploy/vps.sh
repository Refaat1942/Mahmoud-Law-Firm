#!/usr/bin/env bash
# Idempotent first-time / update deploy for lawfirm.fratelanza.com.
# Safe around other projects: unique Compose project, loopback-only port, new nginx
# server_name only. Does not rewrite nginx.conf or stop other containers.
set -euo pipefail

DOMAIN="${DOMAIN:-lawfirm.fratelanza.com}"
APP_DIR="${APP_DIR:-/opt/mahmoud-law-firm}"
REPO="${REPO:-https://github.com/Refaat1942/Mahmoud-Law-Firm.git}"
PORT="${LAW_FIRM_PORT:-3017}"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (or with sudo) so nginx can be reloaded."
  exit 1
fi

if ss -lnt | awk '{print $4}' | grep -qE "[:.]${PORT}$"; then
  if ! ss -lnt | grep -q "127.0.0.1:${PORT}"; then
    echo "Port ${PORT} is already in use on this host. Set LAW_FIRM_PORT to a free port and retry."
    exit 1
  fi
fi

mkdir -p "$APP_DIR"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" reset --hard origin/main
else
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

if [[ ! -f .env ]]; then
  AUTH_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
  POSTGRES_PASSWORD="$(openssl rand -base64 24 | tr -d '\n=/+')"
  MINIO_PASS="$(openssl rand -base64 24 | tr -d '\n=/+')"
  cat > .env <<EOF
DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/law_office
AUTH_SECRET=${AUTH_SECRET}
AUTH_TRUST_HOST=true
APP_URL=https://${DOMAIN}
LAW_FIRM_PORT=${PORT}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
MINIO_ROOT_USER=lawfirm
MINIO_ROOT_PASSWORD=${MINIO_PASS}
S3_REGION=me-central-1
S3_BUCKET=law-office
UPLOAD_DIR=./uploads
REDIS_URL=redis://redis:6379
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Law Office <no-reply@${DOMAIN}>
SEED_DEMO=false
EOF
  chmod 600 .env
  echo "Wrote ${APP_DIR}/.env (not committed). Change the admin password after first login."
fi

mkdir -p backups
docker compose up -d --build

echo "Waiting for the app to finish migrations..."
for _ in $(seq 1 90); do
  if docker compose exec -T app node -e "fetch('http://127.0.0.1:3000').then(r=>process.exit(r.ok||r.status===307?0:1)).catch(()=>process.exit(1))"; then
    break
  fi
  sleep 2
done

docker compose exec -T app npx prisma db seed || true

if command -v nginx >/dev/null 2>&1; then
  SITE_SRC="${APP_DIR}/deploy/nginx-lawfirm.fratelanza.com.conf"
  if [[ -d /etc/nginx/sites-available ]]; then
    cp "$SITE_SRC" /etc/nginx/sites-available/${DOMAIN}
    ln -sfn /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/${DOMAIN}
  elif [[ -d /etc/nginx/conf.d ]]; then
    cp "$SITE_SRC" /etc/nginx/conf.d/${DOMAIN}.conf
  else
    echo "nginx is installed but neither sites-available nor conf.d exists — add the vhost by hand."
  fi
  nginx -t
  systemctl reload nginx
  if command -v certbot >/dev/null 2>&1; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect --register-unsafely-without-email || \
      echo "TLS not issued yet. Point DNS A ${DOMAIN} → this server, then rerun certbot --nginx -d ${DOMAIN}"
  else
    echo "Install certbot and run: certbot --nginx -d ${DOMAIN}"
  fi
elif command -v caddy >/dev/null 2>&1; then
  echo "Caddy detected. Append deploy/caddy-snippet.conf to the Caddyfile and run: caddy reload"
else
  echo "No nginx/caddy found. Install a reverse proxy and point ${DOMAIN} at 127.0.0.1:${PORT}"
fi

echo
echo "Stack: docker compose -p mahmoud-law-firm ps"
echo "Site:  https://${DOMAIN}"
echo "Login: admin@lawoffice.ae  /  Admin@12345  (change immediately)"

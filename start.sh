#!/bin/bash
set -e

# Parse DATABASE_URL into Odoo-compatible flags
if [ -n "$DATABASE_URL" ]; then
  DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
  DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
fi

# Official odoo:19 image has addons at /usr/lib/python3/dist-packages/odoo/addons
# Custom addons go to /mnt/extra-addons (mounted in official image)
ADDONS_PATH="/usr/lib/python3/dist-packages/odoo/addons,/mnt/extra-addons"

exec odoo \
  --db_host="${DB_HOST:-localhost}" \
  --db_port="${DB_PORT:-5432}" \
  --db_user="${DB_USER:-odoo}" \
  --db_password="${DB_PASS:-odoo}" \
  --database="${DB_NAME:-RMS}" \
  --addons-path="$ADDONS_PATH" \
  --http-port="${PORT:-8069}" \
  --http-interface="${HOST:-0.0.0.0}" \
  --proxy-mode \
  --workers="${ODOO_WORKERS:-0}" \
  --without-demo

#!/bin/bash
set -e

# Railway injects ODOO_ADDONS_PATH="/opt/odoo/odoo/addons,/opt/odoo/addons" 
# which causes fatal warnings in the official Docker image. We must unset it.
unset ODOO_ADDONS_PATH

if [ -n "$DATABASE_URL" ]; then
  DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
  DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
fi

# The official odoo:19 image has standard addons here. Custom addons go to /mnt/extra-addons.
export ADDONS_PATH="/usr/lib/python3/dist-packages/odoo/addons,/mnt/extra-addons"

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
  --without-demo=True

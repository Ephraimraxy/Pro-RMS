#!/bin/bash
set -e

# Railway mounts data volumes as root. We must take ownership of the Odoo data directory
# so the 'odoo' user can write sessions and attachments.
mkdir -p /var/lib/odoo/sessions
chown -R odoo:odoo /var/lib/odoo

# Railway injects invalid addon paths. Unset them.
unset ODOO_ADDONS_PATH

# Parse Database URL
if [ -n "$DATABASE_URL" ]; then
  DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
  DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
fi

ADDONS_PATH="/usr/lib/python3/dist-packages/odoo/addons,/mnt/extra-addons"

# Generate the Odoo execution script with hardcoded variables
cat << EOF > /tmp/run_odoo.sh
#!/bin/bash
exec odoo \\
  --db_host="${DB_HOST:-localhost}" \\
  --db_port="${DB_PORT:-5432}" \\
  --db_user="${DB_USER:-odoo}" \\
  --db_password="${DB_PASS:-odoo}" \\
  --database="${DB_NAME:-RMS}" \\
  --addons-path="${ADDONS_PATH}" \\
  --http-port="${PORT:-8069}" \\
  --http-interface="${HOST:-0.0.0.0}" \\
  --proxy-mode \\
  --workers="${ODOO_WORKERS:-0}" \\
  --without-demo=True \\
  -u css_rms_custom
EOF

chmod +x /tmp/run_odoo.sh

# Safely drop privileges to the 'odoo' user and execute the generated script
# The official odoo user has its shell set to /usr/sbin/nologin, so we MUST force /bin/bash via -s
exec su -s /bin/bash -p odoo -c /tmp/run_odoo.sh

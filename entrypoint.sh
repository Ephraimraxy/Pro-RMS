#!/bin/bash
set -e

if [ -n "$DATABASE_URL" ]; then
    echo "Parsing DATABASE_URL..."
    # Use python to safely parse the URL
    eval $(python3 - <<EOF
import os
from urllib.parse import urlparse
url = os.environ.get('DATABASE_URL')
if url:
    result = urlparse(url)
    print(f"export PGHOST={result.hostname}")
    print(f"export PGPORT={result.port or 5432}")
    print(f"export PGUSER={result.username}")
    # Use single quotes for password to handle special characters
    print(f"export PGPASSWORD='{result.password}'")
    # We do NOT export PGDATABASE here because Odoo will try to load it on startup.
    # If the database is not initialized, it will cause an Internal Server Error (500).
EOF
)
    echo "Database host: $PGHOST"
fi

# Odoo uses ODOO_ADMIN_PASSWD for the master password
if [ -n "$ODOO_MASTER_PASSWORD" ]; then
    export ODOO_ADMIN_PASSWD="$ODOO_MASTER_PASSWORD"
fi

# Railway environment overrides
export HOST="0.0.0.0"
export PORT=${PORT:-8069}

# Ensure ODOO_RC points to a valid file or is unset
if [ -n "$ODOO_RC" ] && [ ! -f "$ODOO_RC" ]; then
    echo "Config file $ODOO_RC not found, unsetting ODOO_RC"
    unset ODOO_RC
fi

# IMPORTANT: Railway often sets PGDATABASE automatically.
# Odoo (and psycopg2) picks this up as the default database to serve.
# If it's empty/uninitialized, it crashes with KeyError: 'ir.http'.
# We unset it here to ensure Odoo starts in "Database Manager" mode.
unset PGDATABASE

echo "Starting Odoo..."
exec python3 odoo-bin "$@"

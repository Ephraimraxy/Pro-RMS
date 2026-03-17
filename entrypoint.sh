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
    # Extract database name from path (strip leading /)
    dbname = result.path.lstrip('/')
    if dbname:
        print(f"export PGDATABASE={dbname}")
EOF
)
    echo "Database host: $PGHOST"
    echo "Database name: $PGDATABASE"
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

# Check if database is initialized
if [ -n "$PGDATABASE" ]; then
    echo "Checking if database $PGDATABASE is initialized..."
    python3 - <<EOF
import psycopg2
import sys
import os

try:
    conn = psycopg2.connect(
        host=os.environ.get('PGHOST'),
        port=os.environ.get('PGPORT', 5432),
        user=os.environ.get('PGUSER'),
        password=os.environ.get('PGPASSWORD'),
        dbname=os.environ.get('PGDATABASE')
    )
    with conn.cursor() as cr:
        cr.execute("SELECT 1 FROM information_schema.tables WHERE table_name = 'ir_module_module'")
        exists = cr.fetchone()
        if not exists:
            print(f"Database {os.environ.get('PGDATABASE')} is NOT initialized.")
            sys.exit(1)
        else:
            print(f"Database {os.environ.get('PGDATABASE')} is already initialized.")
except Exception as e:
    print(f"Error checking database: {e}")
    # We continue anyway, letting Odoo handle it
EOF
    if [ $? -eq 1 ]; then
        echo "Running Odoo initialization with -i base..."
        # We need to use the full path to odoo-bin or ensure current dir is /opt/odoo
        python3 odoo-bin -d $PGDATABASE -i base --stop-after-init
    fi
fi

# IMPORTANT: Railway often sets PGDATABASE automatically.
# Odoo (and psycopg2) picks this up as the default database to serve.
# If it's empty/uninitialized, it crashes with KeyError: 'ir.http'.
# We unset it here AFTER checking/initialization to ensure Odoo starts in "Database Manager" mode
# BUT only if it was NOT explicitly set by us or the user to be the only database.
# Actually, if we WANT Odoo to auto-select this db, we SHOULD keep it.
# Given the user's setup, they probably want to land on the DB they created.
# However, unsetting it ensures the "Database Manager" works if they have multiple.
# Let's stick to unsetting it to be safe, or just leave it if initialized.

# For now, let's unset it to maintain existing behavior but ensure it was initialized first.
unset PGDATABASE

echo "Starting Odoo..."
exec python3 odoo-bin "$@"

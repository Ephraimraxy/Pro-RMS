#!/bin/bash
set -e

# Extract DB credentials from DATABASE_URL if provided by Railway
if [ -n "$DATABASE_URL" ]; then
    echo "Parsing DATABASE_URL for Odoo configuration..."
    
    # Extract host
    HOST=$(echo $DATABASE_URL | sed -e 's|.*@||' -e 's|:.*||' -e 's|/.*||')
    export ODOO_DB_HOST="$HOST"
    
    # Extract port (default to 5432 if not present)
    PORT=$(echo $DATABASE_URL | sed -e 's|.*:||' -e 's|/.*||')
    if [[ "$PORT" =~ ^[0-9]+$ ]]; then
        export ODOO_DB_PORT="$PORT"
    else
        export ODOO_DB_PORT="5432"
    fi
    
    # Extract user
    USER=$(echo $DATABASE_URL | sed -e 's|.*//||' -e 's|:.*@.*||')
    export ODOO_DB_USER="$USER"
    
    # Extract password
    # Handle the case where password might contain special characters
    PASSWORD=$(echo $DATABASE_URL | sed -e 's|.*//||' -e 's|.*:||' -e 's|@.*||')
    export ODOO_DB_PASSWORD="$PASSWORD"
    
    echo "DB Configured: Host=$ODOO_DB_HOST, Port=$ODOO_DB_PORT, User=$ODOO_DB_USER"
fi

# Set other defaults if not provided by Railway
export ODOO_HTTP_INTERFACE=${HOST:-0.0.0.0}
export ODOO_HTTP_PORT=${PORT:-8069}
export ODOO_PROXY_MODE=${ODOO_PROXY_MODE:-true}

# If ODOO_ADMIN_PASSWD is set but ODOO_MASTER_PASSWORD is used in Railway
if [ -n "$ODOO_MASTER_PASSWORD" ]; then
    export ODOO_ADMIN_PASSWD="$ODOO_MASTER_PASSWORD"
fi

exec python3 odoo-bin "$@"

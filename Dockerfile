FROM python:3.12-slim-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libldap2-dev \
    libsasl2-dev \
    libssl-dev \
    libjpeg-dev \
    zlib1g-dev \
    libpng-dev \
    libxml2-dev \
    libxslt1-dev \
    libwebp-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    libxcb1-dev \
    libfreetype6-dev \
    liblcms2-dev \
    libopenjp2-7-dev \
    postgresql-client \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /opt/odoo

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Create a non-root user
RUN useradd -m -d /opt/odoo -s /bin/bash odoo

# Create folders for the filestore and config with correct permissions
RUN mkdir -p /var/lib/odoo /etc/odoo && \
    chown -R odoo:odoo /opt/odoo /var/lib/odoo /etc/odoo

# Make entrypoint script executable
RUN chmod +x /opt/odoo/entrypoint.sh

# Default environment variables
ENV ODOO_RC /etc/odoo/odoo.conf
ENV HOST 0.0.0.0
ENV PORT 8069

# Expose Odoo port
EXPOSE 8069

# Switch to non-root user
USER odoo

# Entry point
ENTRYPOINT ["/opt/odoo/entrypoint.sh"]
CMD ["--http-interface", "0.0.0.0", "--http-port", "8069"]

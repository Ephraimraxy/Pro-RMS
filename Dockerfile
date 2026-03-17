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

# Create a volume for the filestore
RUN mkdir -p /var/lib/odoo && chown -R 1000:1000 /var/lib/odoo
VOLUME ["/var/lib/odoo"]

# Default environment variables
ENV ODOO_RC /etc/odoo/odoo.conf
ENV HOST 0.0.0.0
ENV PORT 8069

# Expose Odoo port
EXPOSE 8069

# Entry point
CMD ["python3", "odoo-bin", "--http-interface", "0.0.0.0", "--http-port", "8069"]

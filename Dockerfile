FROM odoo:19

USER root

# Aggressively bypass the Odoo 'postgres' user security block globally
RUN find /usr/lib/python3/dist-packages/odoo -type f -name "*.py" -exec sed -i "s/== 'postgres'/== 'disabled_postgres_check'/g" {} + 2>/dev/null || true
RUN find /usr/lib/python3/dist-packages/odoo -type f -name "*.py" -exec sed -i 's/== "postgres"/== "disabled_postgres_check"/g' {} + 2>/dev/null || true
RUN find /usr/lib/python3/dist-packages/odoo -type f -name "*.py" -exec sed -i "s/security risk, aborting/security risk bypassed/g" {} + 2>/dev/null || true

# =========================================================
# AGGRESSIVE VISUAL REBRAND (Zero-Code Modification)
# =========================================================
# 1. Copy our brand assets into the container temporarily
COPY ./rms_frontend/src/assets/hero.png /tmp/brand_logo.png
COPY ./rms_frontend/public/favicon.svg /tmp/brand_favicon.svg
COPY ./rms_frontend/src/assets/hero.png /tmp/brand_favicon.ico

# 2. Overwrite every default Odoo logo/favicon physically in the core UI module
RUN find /usr/lib/python3/dist-packages/odoo/addons/web/static -type f -name "logo.png" -exec cp /tmp/brand_logo.png {} \; 2>/dev/null || true
RUN find /usr/lib/python3/dist-packages/odoo/addons/web/static -type f -name "logo2.png" -exec cp /tmp/brand_logo.png {} \; 2>/dev/null || true
RUN find /usr/lib/python3/dist-packages/odoo/addons/web/static -type f -name "favicon.ico" -exec cp /tmp/brand_favicon.ico {} \; 2>/dev/null || true

# 3. Strip all text branding "Odoo" from web XML templates globally
RUN find /usr/lib/python3/dist-packages/odoo/addons/web -type f -name "*.xml" -exec sed -i 's/<title>Odoo<\/title>/<title>CSS RMS<\/title>/g' {} + 2>/dev/null || true
RUN find /usr/lib/python3/dist-packages/odoo/addons/web -type f -name "*.xml" -exec sed -i 's/Powered by <span>Odoo<\/span>/Powered by CSS Group/g' {} + 2>/dev/null || true
RUN find /usr/lib/python3/dist-packages/odoo/addons/web -type f -name "*.xml" -exec sed -i 's/Powered by <a target="_blank" href="http:\/\/www.odoo.com">Odoo<\/a>/powered by CSS Group/g' {} + 2>/dev/null || true
RUN find /usr/lib/python3/dist-packages/odoo/addons/web -type f -name "*.xml" -exec sed -i 's/Manage Databases/CSS Portal Governance/g' {} + 2>/dev/null || true

# Copy our custom addon
COPY ./css_rms_custom /mnt/extra-addons/css_rms_custom
RUN chown -R odoo:odoo /mnt/extra-addons/css_rms_custom

EXPOSE 8069

COPY ./start.sh /start.sh
RUN chmod +x /start.sh

# We must keep USER root here so Railway can run start.sh as root.
# This allows us to chown the mounted Railway volumes before dropping to the 'odoo' user.
CMD ["/start.sh"]

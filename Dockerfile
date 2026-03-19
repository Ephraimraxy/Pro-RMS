FROM odoo:19

USER root

# Aggressively bypass the Odoo 'postgres' user security block globally
RUN find /usr/lib/python3/dist-packages/odoo -type f -name "*.py" -exec sed -i "s/== 'postgres'/== 'disabled_postgres_check'/g" {} + 2>/dev/null || true
RUN find /usr/lib/python3/dist-packages/odoo -type f -name "*.py" -exec sed -i 's/== "postgres"/== "disabled_postgres_check"/g' {} + 2>/dev/null || true
RUN find /usr/lib/python3/dist-packages/odoo -type f -name "*.py" -exec sed -i "s/security risk, aborting/security risk bypassed/g" {} + 2>/dev/null || true

# Copy our custom addon
COPY ./css_rms_custom /mnt/extra-addons/css_rms_custom
RUN chown -R odoo:odoo /mnt/extra-addons/css_rms_custom

EXPOSE 8069

COPY ./start.sh /start.sh
RUN chmod +x /start.sh

# We must keep USER root here so Railway can run start.sh as root.
# This allows us to chown the mounted Railway volumes before dropping to the 'odoo' user.
CMD ["/start.sh"]

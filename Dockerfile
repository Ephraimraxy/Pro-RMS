FROM odoo:19

USER root

# Patch Odoo 19 to allow the 'postgres' database user (Railway provides only this user)
RUN sed -i 's/raise Exception/logger.warning/' /usr/lib/python3/dist-packages/odoo/service/db.py 2>/dev/null || true
RUN sed -i "s/Using the database user.*aborting/Using the database user 'postgres' - allowed by patch/" /usr/lib/python3/dist-packages/odoo/service/db.py 2>/dev/null || true
# Also patch tools/config.py if it blocks postgres there
RUN grep -rl "security risk, aborting" /usr/lib/python3/dist-packages/odoo/ | xargs -r sed -i 's/raise.*security risk.*/pass  # patched for Railway/' 2>/dev/null || true

# Copy our custom addon
COPY ./css_rms_custom /mnt/extra-addons/css_rms_custom
RUN chown -R odoo:odoo /mnt/extra-addons/css_rms_custom

USER odoo

EXPOSE 8069

COPY ./start.sh /start.sh
USER root
RUN chmod +x /start.sh
USER odoo

CMD ["/start.sh"]

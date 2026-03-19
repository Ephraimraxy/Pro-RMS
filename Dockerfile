FROM odoo:19

USER root

# Copy our custom addon into the Odoo addons directory
COPY ./css_rms_custom /opt/odoo/addons/css_rms_custom

# Ensure correct permissions
RUN chown -R odoo:odoo /opt/odoo/addons/css_rms_custom

USER odoo

EXPOSE 8069

COPY ./start.sh /start.sh
USER root
RUN chmod +x /start.sh
USER odoo

CMD ["/start.sh"]

import os
from odoo import http
from odoo.http import request
from odoo.modules.module import get_resource_path

class RMS ReactPortal(http.Controller):
    # Intercept the root route and any arbitrary client-side React routes
    @http.route(['/', '/app', '/app/<path:path>'], type='http', auth="none", website=True, sitemap=False, priority=1)
    def serve_react_app(self, **kw):
        # Locate the compiled React index.html within this module's static folder
        index_path = get_resource_path('css_rms_custom', 'static/react', 'index.html')
        
        if not index_path or not os.path.exists(index_path):
            return request.redirect('/web') # Fallback to standard Odoo if React build is missing

        # Read and serve the raw HTML
        with open(index_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
            
        return request.make_response(html_content, headers=[('Content-Type', 'text/html; charset=utf-8')])

    # Overwrite the standard Odoo application routes to force the React Portal
    @http.route('/web/login', type='http', auth="none", website=True, priority=100)
    def override_login(self, **kw):
        return request.redirect('/')

    @http.route('/web/database/manager', type='http', auth="none", website=True, priority=100)
    def override_db_manager(self, **kw):
        return request.redirect('/')

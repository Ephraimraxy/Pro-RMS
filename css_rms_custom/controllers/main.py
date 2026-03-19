from odoo import http
from odoo.http import request

class RootRedirect(http.Controller):
    @http.route('/', type='http', auth="none", website=True, sitemap=False, priority=1)
    def index_redirect(self, **kw):
        return request.redirect('/web')

    @http.route('/shop', type='http', auth="none", website=True)
    def shop_redirect(self, **kw):
        return request.redirect('/web')

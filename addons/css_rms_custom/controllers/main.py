from odoo import http
from odoo.http import request

class RootRedirect(http.Controller):
    @http.route('/', type='http', auth="none")
    def index(self, **kw):
        return request.redirect('/web')

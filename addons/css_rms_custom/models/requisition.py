from odoo import models, fields, api, _

class CssRmsStage(models.Model):
    _name = 'css.rms.stage'
    _description = 'RMS Approval Stage'
    _order = 'sequence'

    name = fields.Char(string='Stage Name', required=True)
    sequence = fields.Integer(string='Sequence', default=10)
    role_id = fields.Many2one('res.groups', string='Approver Group', required=True)
    min_amount = fields.Float(string='Min Amount', default=0.0)
    max_amount = fields.Float(string='Max Amount', default=0.0)
    is_final = fields.Boolean(string='Final Approval Stage')

class CssRmsRequisition(models.Model):
    _name = 'css.rms.requisition'
    _description = 'CSS-RMS Requisition'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(string='Reference', required=True, copy=False, readonly=True, default=lambda self: _('New'))
    type = fields.Selection([
        ('material', 'Material Requisition'),
        ('cash', 'Cash Requisition'),
        ('memo', 'Memo')
    ], string='Requisition Type', required=True, tracking=True)
    
    description = fields.Text(string='Description', required=True)
    amount = fields.Float(string='Amount', tracking=True)
    state = fields.Selection([
        ('draft', 'Draft'),
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected')
    ], string='Status', default='draft', tracking=True)

    stage_id = fields.Many2one('css.rms.stage', string='Current Approval Stage', tracking=True)
    user_id = fields.Many2one('res.users', string='Requested By', default=lambda self: self.env.user, required=True)
    department_id = fields.Many2one('hr.department', string='Department', compute='_compute_department', store=True)

    @api.depends('user_id')
    def _compute_department(self):
        for rec in self:
            rec.department_id = rec.user_id.employee_id.department_id if rec.user_id.employee_id else False

    @api.model
    def create(self, vals):
        if vals.get('name', _('New')) == _('New'):
            vals['name'] = self.env['ir.sequence'].next_by_code('css.rms.requisition') or _('New')
        return super(CssRmsRequisition, self).create(vals)

    def action_submit(self):
        # Find first stage based on amount
        next_stage = self.env['css.rms.stage'].search([
            ('min_amount', '<=', self.amount),
            '|', ('max_amount', '>=', self.amount), ('max_amount', '=', 0.0)
        ], order='sequence', limit=1)
        if next_stage:
            self.write({'state': 'pending', 'stage_id': next_stage.id})
        else:
            self.write({'state': 'approved'})

    def action_approve(self):
        # Logic to move to next stage or finish
        next_stage = self.env['css.rms.stage'].search([
            ('sequence', '>', self.stage_id.sequence),
            ('min_amount', '<=', self.amount),
            '|', ('max_amount', '>=', self.amount), ('max_amount', '=', 0.0)
        ], order='sequence', limit=1)
        if next_stage:
            self.write({'stage_id': next_stage.id})
        else:
            self.write({'state': 'approved', 'stage_id': False})

    def action_reject(self):
        self.write({'state': 'rejected', 'stage_id': False})

{
    'name': 'CSS-RMS Custom Workflow',
    'version': '1.0',
    'category': 'Operations/Requisition',
    'summary': 'Custom Requisition Workflow and Approval Stages',
    'description': """
        Implements the specific Requisition Management System (RMS) SRS:
        - Custom Approval Roles (Admin, Audit, GM, Chairman)
        - Threshold-based routing logic
        - Memo and Cash requisition extensions
    """,
    'author': 'Antigravity',
    'depends': ['base', 'purchase_requisition', 'hr_expense'],
    'data': [
        'security/security.xml',
        'security/ir_rule.xml',
        'security/ir.model.access.csv',
        'data/ir_sequence_data.xml',
        'data/rms_stage_data.xml',
        'data/res_users_data.xml',
        'views/requisition_views.xml',
        'views/web_login_override.xml',
    ],
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}

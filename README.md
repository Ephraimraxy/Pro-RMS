# CSS-RMS: Enterprise Requisition Management System

A premium, "Zero-Hardcoding" internal workflow platform for CSS Group. This project features a high-fidelity React frontend (Aura Design System) that interfaces with a headless Odoo backend.

## Project Structure

```bash
├── rms_frontend/       # Premium React + Vite + Tailwind + Framer Motion
└── css_rms_custom/     # Custom Odoo 19 Backend Module (Logic & Data)
```

## Key Features

- **Auth-Guarded Portal**: Secure Odoo session integration with glassmorphic visuals.
- **Adaptive Form Engine**: Dynamic requisition forms for Material, Cash, and Memos.
- **Workflow & Audit**: Multi-stage approval timeline with automated threshold routing.
- **Admin Governance**:
  - **Workflow Builder**: Define approval stages and currency limits via UI.
  - **Department Manager**: Manage the 32-department corporate hierarchy.
  - **Audit Ledger**: Immutable history of all system activities.

## Development

### Frontend (React)
```bash
cd rms_frontend
npm install
npm run dev    # For internal development
npm run build  # For production deployment
```

### Backend (Odoo)
The backend is hosted on Railway: `pro-rms-production.up.railway.app`. Use the `css_rms_custom` module for local reference or future logic updates.

---
*Built with excellence by Antigravity*

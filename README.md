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

## Environment Variables (Node API)
Required for production:
- `JWT_SECRET` - session signing secret
- `SIGNING_PRIVATE_KEY` - Ed25519 private key (PEM or base64)
- `SIGNING_PUBLIC_KEY` - Ed25519 public key (PEM or base64)
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (and optional `S3_ENDPOINT`)

Optional:
- `CORS_ORIGIN` (comma-separated allowed origins)
- `NODE_ENV=production`
- `APP_BASE_URL` (used in email links)
- `MAIL_FROM` (override from address)
- `GMAIL_USER` + `GMAIL_APP_PASSWORD` (Gmail app password SMTP)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` (generic SMTP)

Cloudflare R2 Storage (S3-compatible):
- `R2_ACCOUNT_ID` 
- `R2_ACCESS_KEY_ID` 
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME` 

If no external storage is configured, files upload locally to `uploads/`.

---
*Built with excellence by Antigravity*

# Passbook - Education Loan Clarity

Passbook is a privacy-first static web app for comparing education loan offers before signing a sanction letter. It started from `loan-clarity-v3.html` and has been promoted into a deployable project with separated HTML, CSS, JavaScript, tests, a manifest, and offline caching.

## What Changed

- Moved the prototype into the current workspace as a self-contained app.
- Added scenario comparison for EMI strain, moratorium capitalisation, simple-interest servicing, processing fees, prepayment, 80E estimate, collateral prompts, and margin prompts.
- Added production basics: CSP, no third-party scripts, local-only calculations, responsive layout, print/PDF, Web Share API fallback, PWA manifest, service worker, and Node tests.
- Added a launch checklist and integration roadmap directly in the product surface.

## Run

```bash
npm start
```

Open `http://localhost:4173`.

## Verify

```bash
npm test
npm run check
```

## Recommended Integrations

- PM Vidyalaxmi / Vidya Lakshmi deep link and application status handoff.
- Lender rate-card ingestion with source URL, effective date, and expiry date.
- Sanction-letter upload parser for APR, moratorium, collateral, margin, fees, and insurance add-ons.
- Counsellor CRM workflow for high-risk scenarios and document follow-up.
- Privacy-preserving analytics that records scenario bands, not raw loan or salary values.
- Optional account layer only after consent, with encrypted saved comparisons.

## Source Notes

The app intentionally treats policy and lender rules as prompts, not promises. Before launch with live claims, connect every preset to dated source records and show source freshness in the UI.

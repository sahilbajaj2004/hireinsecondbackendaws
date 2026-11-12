# Approve KYC and Post SoberDev Jobs

## Intent

Approve KYC for `sahilbajaj2004@gmail.com` and publish three realistic software roles for that account's company, SoberDev, in the configured MongoDB `TalentLink` database.

## Goals

- Change the one matching user's KYC status from `inprogress` to the application's successful value, `approved`.
- Add these active, full-time Phase B listings under the user's existing company ID:
  1. **Senior Full-Stack Developer (React/Node.js)** — Bengaluru, hybrid; 2 openings; 3–5 years; INR 1,800,000 annual budget.
  2. **Backend Engineer (Node.js/MongoDB)** — Remote, India; 2 openings; 2–4 years; INR 1,500,000 annual budget.
  3. **Frontend Developer (Next.js/TypeScript)** — New Delhi, hybrid; 1 opening; 2–4 years; INR 1,200,000 annual budget.
- Populate the schema's required job fields, company/display name, descriptions, qualifications, notice period, hiring terms, and relevant skills.
- Verify the saved KYC status and all three jobs after writing.

## Non-goals and Safety

- Do not change application code, other users, or existing jobs.
- Do not send KYC notifications or emails; this is a direct data correction.
- Do not create duplicate jobs if a SoberDev job with the same title already exists.

## Constraints

- Resolve the company ID from the requested email instead of hardcoding it.
- Require exactly one matching user before changing data.
- Use the existing Mongoose models and the active `.env` connection without exposing credentials.

## Approaches

- **Chosen: direct model-backed database update.** Smallest path, supports duplicate checks, and allows immediate verification.
- **Not chosen: authenticated API calls.** Requires administrative/client tokens and invokes legacy salary calculations without improving this one-off operation.

## Execution

Run a one-off Node process from this repository. It will validate the user, update KYC, insert only missing titles with complete records, then read the records back and report the result. No reusable migration or dependency is needed.

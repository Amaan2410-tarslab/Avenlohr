# Avenlo 3.0

Private talent-intelligence and human-led matching platform.

> Talent intelligence. Human decisions.

## Current production foundation

- Next.js App Router + TypeScript
- Supabase Auth, PostgreSQL, RLS and private Storage
- Candidate onboarding and private CV upload
- Candidate profile and skills management
- Company onboarding and job publishing
- Internal staff/founder review workspace
- Structured matching library with tests
- GitHub Actions verification pipeline

## Local setup

```bash
npm install
cp .env.example .env.local
npm run lint
npm run typecheck
npm test
npm run build
```

Apply the SQL migrations in `supabase/migrations` in filename order in your Supabase project.

## Environment

Required public variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

Never commit Supabase service-role keys or other secrets.

## Roles

- `candidate` — private professional profile and applications
- `company` — company profile and job publishing
- `staff` — internal human review workspace
- `founder` — internal workspace with founder-level access

New public signups can select only candidate or company. Staff/founder roles must be assigned through a controlled administrative process.

## Security model

Candidate CVs live in a private Supabase Storage bucket. Row-level security limits candidate data to the candidate and controlled internal roles. Candidates cannot change their own role, profile status, or application review status.

## Deployment

The intended production path is GitHub → Vercel for the Next.js application and Supabase for Auth/Database/Storage. Do not deploy until the verification workflow is green and the Supabase migrations have been applied successfully.

<!-- CI verification trigger: Phase 2.2 security suite -->

# Avenlo 3.0

Private talent-intelligence and human-led matching platform.

> Talent intelligence. Human decisions.

## Stack

- Next.js
- TypeScript
- React
- Supabase Auth / PostgreSQL / Storage
- Vitest

## Local setup

```bash
npm install
cp .env.example .env.local
npm run lint
npm run typecheck
npm test
npm run build
```

Run the Supabase migrations in `supabase/migrations` in order, then configure the environment variables.

## Required environment

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

Never commit service-role keys or other secrets.

## Product principle

Avenlo is not a public job board. Candidates join a private talent network, companies submit requirements, and Avenlo staff use structured intelligence and explainable matching while humans make final decisions.

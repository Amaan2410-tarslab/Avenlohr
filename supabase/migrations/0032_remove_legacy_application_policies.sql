-- Remove legacy application policies left by the initial hardening chain.
-- The current operation-specific policies are defined in 0028-0031.

drop policy if exists "company read applications" on public.applications;
drop policy if exists "candidates apply to open jobs" on public.applications;
drop policy if exists "company staff read applications" on public.applications;
drop policy if exists "candidates manage own applications" on public.applications;

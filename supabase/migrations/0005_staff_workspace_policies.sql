-- Staff and founders are the internal human decision-makers and need read access to candidate/company intelligence.
create policy "staff read profiles"
on public.profiles
for select to authenticated
using (public.current_user_role() in ('staff', 'founder') or id = auth.uid());

create policy "staff read candidate profiles"
on public.candidate_profiles
for select to authenticated
using (public.current_user_role() in ('staff', 'founder') or user_id = auth.uid());

create policy "staff read candidate skills"
on public.candidate_skills
for select to authenticated
using (public.current_user_role() in ('staff', 'founder') or user_id = auth.uid());

create policy "staff read companies"
on public.companies
for select to authenticated
using (public.current_user_role() in ('staff', 'founder') or owner_id = auth.uid());

create policy "staff read jobs"
on public.jobs
for select to authenticated
using (public.current_user_role() in ('staff', 'founder') or status = 'open' or exists (
  select 1 from public.companies c where c.id = jobs.company_id and c.owner_id = auth.uid()
));

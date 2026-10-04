import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JobCard } from "./job-card";

type CompanyRelation = { name?: string } | Array<{ name?: string }> | null;

type JobRow = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  work_mode: string | null;
  seniority: string | null;
  experience_years: number | null;
  companies: CompanyRelation;
};

export default async function CandidateJobs() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "candidate") redirect("/dashboard");

  const [{ data: jobs }, { data: applications }] = await Promise.all([
    supabase.from("jobs").select("id, title, description, location, work_mode, seniority, experience_years, companies(name)").eq("status", "open").order("created_at", { ascending: false }).limit(100),
    supabase.from("applications").select("job_id").eq("candidate_id", user.id),
  ]);

  const appliedJobIds = new Set((applications ?? []).map((application) => application.job_id));
  const jobRows = (jobs ?? []) as unknown as JobRow[];

  return <main className="page">
    <nav className="nav container"><span className="brand">AVENLO</span><div className="actions"><Link className="btn" href="/dashboard">Dashboard</Link></div></nav>
    <section className="hero container" style={{ maxWidth: 1100 }}>
      <span className="eyebrow">OPEN ROLES</span>
      <h1>Opportunities selected for human review.</h1>
      <p>Apply to roles that fit your profile. Avenlo keeps applications private and uses matching signals to support human decisions.</p>
      <div className="grid">{jobRows.map((job) => { const companies = job.companies; const companyName = Array.isArray(companies) ? companies[0]?.name ?? null : companies?.name ?? null; return <JobCard key={job.id} job={{ ...job, company_name: companyName }} applied={appliedJobIds.has(job.id)} />; })}{!jobRows.length ? <p className="muted">There are no open roles available right now.</p> : null}</div>
    </section>
  </main>;
}

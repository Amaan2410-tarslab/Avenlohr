import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JobCard } from "../job-card";

export const dynamic = "force-dynamic";

type CompanyRelation = { name?: string } | Array<{ name?: string }> | null;

type JobRow = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  work_mode: string | null;
  seniority: string | null;
  experience_years: number | null;
  expires_at: string | null;
  companies: CompanyRelation;
};

export default async function CandidateJobDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "candidate") redirect("/dashboard");

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, description, location, work_mode, seniority, experience_years, expires_at, companies(name)")
    .eq("id", id)
    .maybeSingle();

  if (!job) notFound();

  const { data: application } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", id)
    .eq("candidate_id", user.id)
    .maybeSingle();

  const row = job as unknown as JobRow;
  const companies = row.companies;
  const companyName = Array.isArray(companies) ? companies[0]?.name ?? null : companies?.name ?? null;

  return <main className="page">
    <nav className="nav container">
      <span className="brand">AVENLO</span>
      <div className="actions">
        <Link className="btn" href="/dashboard/jobs">Back to roles</Link>
        <Link className="btn" href="/dashboard/applications">Applications</Link>
      </div>
    </nav>
    <section className="hero container" style={{ maxWidth: 900 }}>
      <span className="eyebrow">{companyName || "AVENLO COMPANY"}</span>
      <h1>{row.title}</h1>
      <p>{row.description}</p>
      <div className="grid">
        <article className="card"><span className="eyebrow">LOCATION</span><h3>{row.location || "Flexible"}</h3></article>
        <article className="card"><span className="eyebrow">WORK MODE</span><h3>{row.work_mode || "Flexible"}</h3></article>
        <article className="card"><span className="eyebrow">EXPERIENCE</span><h3>{row.experience_years == null ? "Flexible" : row.experience_years + "+ years"}</h3></article>
      </div>
      <div className="section">
        <JobCard
          job={{
            id: row.id,
            title: row.title,
            description: row.description,
            location: row.location,
            work_mode: row.work_mode,
            seniority: row.seniority,
            experience_years: row.experience_years,
            company_name: companyName,
          }}
          applied={Boolean(application)}
        />
        {row.expires_at ? <p className="muted">Application window closes {new Date(row.expires_at).toLocaleString()}.</p> : null}
      </div>
    </section>
  </main>;
}

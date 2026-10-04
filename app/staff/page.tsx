import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type CompanyRelation = { name?: string } | Array<{ name?: string }> | null;

export default async function StaffWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: current } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (current?.role !== "staff" && current?.role !== "founder") redirect("/dashboard");

  const [{ data: candidates }, { data: jobs }, { data: applications }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, headline, location, status").eq("role", "candidate").order("created_at", { ascending: false }).limit(50),
    supabase.from("jobs").select("id, title, status, company_id, companies(name)").order("created_at", { ascending: false }).limit(50),
    supabase.from("applications").select("id, candidate_id, job_id, status, match_score, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  return <main className="page">
    <nav className="nav container"><span className="brand">AVENLO / STAFF</span><Link className="btn" href="/">Public site</Link></nav>
    <section className="hero container" style={{ maxWidth: 1100 }}>
      <span className="eyebrow">HUMAN DECISION WORKSPACE</span>
      <h1>Talent intelligence, reviewed by people.</h1>
      <p>Internal workspace for reviewing private candidate profiles, open roles and application signals. Matching recommendations support decisions; they do not make hiring decisions.</p>
      <div className="section"><h2>Candidates</h2><div className="grid">{(candidates ?? []).map((candidate) => <article className="card" key={candidate.id}><span className="eyebrow">{candidate.status}</span><h3>{candidate.full_name || "Unnamed candidate"}</h3><p className="muted">{candidate.headline || "No headline"}<br />{candidate.location || "Location not provided"}</p></article>)}{!candidates?.length ? <p className="muted">No candidates yet.</p> : null}</div></div>
      <div className="section"><h2>Roles</h2><div className="grid">{(jobs ?? []).map((job) => { const companies = job.companies as CompanyRelation; const companyName = Array.isArray(companies) ? companies[0]?.name : companies?.name; return <article className="card" key={job.id}><span className="eyebrow">{job.status}</span><h3>{job.title}</h3><p className="muted">{companyName || "Company"}</p></article>; })}{!jobs?.length ? <p className="muted">No jobs yet.</p> : null}</div></div>
      <div className="section"><h2>Application signals</h2><div className="grid">{(applications ?? []).map((application) => <article className="card" key={application.id}><span className="eyebrow">{application.status}</span><h3>{application.match_score == null ? "Awaiting review" : `${application.match_score}% match signal`}</h3><p className="muted">Candidate and role IDs are available for the next review workflow.</p></article>)}{!applications?.length ? <p className="muted">No applications yet.</p> : null}</div></div>
    </section>
  </main>;
}

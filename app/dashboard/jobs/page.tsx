import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JobCard } from "./job-card";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  location?: string;
  workMode?: string;
  page?: string;
};

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

const PAGE_SIZE = 12;

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (character) => "\\" + character);

function pageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return "/dashboard/jobs?" + next.toString();
}

export default async function CandidateJobs({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const location = (params.location ?? "").trim().slice(0, 80);
  const workMode = (params.workMode ?? "").trim().slice(0, 30);
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "candidate") redirect("/dashboard");

  let jobsQuery = supabase
    .from("jobs")
    .select("id, title, description, location, work_mode, seniority, experience_years, expires_at, companies(name)", { count: "exact" })
    .eq("status", "open")
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("created_at", { ascending: false });

  if (q) {
    jobsQuery = jobsQuery.ilike("title", "%" + escapeLike(q) + "%");
  }
  if (location) {
    jobsQuery = jobsQuery.ilike("location", "%" + escapeLike(location) + "%");
  }
  if (workMode) {
    jobsQuery = jobsQuery.ilike("work_mode", "%" + escapeLike(workMode) + "%");
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data: jobs, count, error: jobsError } = await jobsQuery.range(from, to);

  if (jobsError) {
    throw new Error("Unable to load open roles.");
  }

  const jobRows = (jobs ?? []) as unknown as JobRow[];
  const jobIds = jobRows.map((job) => job.id);

  const { data: applications } = jobIds.length
    ? await supabase.from("applications").select("job_id").eq("candidate_id", user.id).in("job_id", jobIds)
    : { data: [] as { job_id: string }[] };

  const appliedJobIds = new Set((applications ?? []).map((application) => application.job_id));
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const normalizedPage = Math.min(page, totalPages);

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (location) query.set("location", location);
  if (workMode) query.set("workMode", workMode);

  return <main className="page">
    <nav className="nav container">
      <span className="brand">AVENLO</span>
      <div className="actions">
        <Link className="btn" href="/dashboard">Dashboard</Link>
        <Link className="btn" href="/dashboard/applications">Applications</Link>
      </div>
    </nav>

    <section className="hero container" style={{ maxWidth: 1100 }}>
      <span className="eyebrow">OPEN ROLES</span>
      <h1>Opportunities selected for human review.</h1>
      <p>Search open roles, filter by location or work mode, and apply to roles that fit your profile.</p>

      <form className="card form" method="get" style={{ marginBottom: 28 }}>
        <label>Search by title<input name="q" value={q} placeholder="Product Manager, Data Analyst, Software Engineer" /></label>
        <div className="grid">
          <label>Location<input name="location" value={location} placeholder="Hyderabad, Bengaluru, Remote" /></label>
          <label>Work mode<select name="workMode" value={workMode}>
            <option value="">Any work mode</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select></label>
        </div>
        <button className="btn primary" type="submit">Search roles</button>
      </form>

      <p className="muted">{count ?? 0} matching role{(count ?? 0) === 1 ? "" : "s"} found.</p>

      <div className="grid">
        {jobRows.map((job) => {
          const companies = job.companies;
          const companyName = Array.isArray(companies) ? companies[0]?.name ?? null : companies?.name ?? null;
          return <JobCard key={job.id} job={{ ...job, company_name: companyName }} applied={appliedJobIds.has(job.id)} />;
        })}
        {!jobRows.length ? <p className="muted">There are no open roles matching those filters.</p> : null}
      </div>

      {totalPages > 1 ? <nav className="actions" aria-label="Job results pagination">
        {normalizedPage > 1 ? <Link className="btn" href={pageHref(query, normalizedPage - 1)}>Previous</Link> : null}
        <span className="muted" style={{ alignSelf: "center" }}>Page {normalizedPage} of {totalPages}</span>
        {normalizedPage < totalPages ? <Link className="btn" href={pageHref(query, normalizedPage + 1)}>Next</Link> : null}
      </nav> : null}
    </section>
  </main>;
}

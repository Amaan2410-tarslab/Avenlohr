import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JobModeration } from "./job-moderation";
import { ApplicationReview } from "./application-review";
import { ProfileStatusControl } from "./profile-status-control";
import { ReportStatusControl } from "./report-status-control";
import { SignOutButton } from "@/app/components/sign-out-button";

type CompanyRelation = { name?: string } | Array<{ name?: string }> | null;

export default async function StaffWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: current } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (current?.role !== "staff" && current?.role !== "founder") redirect("/dashboard");

  const [{ data: users }, { data: candidates }, { data: companies }, { data: jobs }, { data: applications }, { data: reports }, { data: auditLogs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, status, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id, full_name, headline, location, status").eq("role", "candidate").order("created_at", { ascending: false }).limit(50),
    supabase.from("companies").select("id, name, industry, location, owner_id, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("jobs").select("id, title, status, company_id, expires_at, companies(name)").order("created_at", { ascending: false }).limit(50),
    supabase.from("applications").select("id, candidate_id, job_id, status, match_score, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("moderation_reports").select("id, reporter_id, target_type, target_id, reason, status, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("audit_logs").select("id, actor_id, action, entity_type, entity_id, metadata, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  return <main className="page">
    <nav className="nav container">
      <span className="brand">AVENLO / STAFF</span>
      <div className="actions"><Link className="btn" href="/">Public site</Link><SignOutButton /></div>
    </nav>

    <section className="hero container" style={{ maxWidth: 1150 }}>
      <span className="eyebrow">ADMIN & MODERATION</span>
      <h1>Talent intelligence, reviewed by people.</h1>
      <p>Internal workspace for users, companies, jobs, applications, account moderation and security events. Matching recommendations support decisions; they do not make hiring decisions.</p>

      <div className="section">
        <h2>Users</h2>
        <div className="grid">
          {(users ?? []).map((profile) => <article className="card" key={profile.id}>
            <span className="eyebrow">{profile.role} · {profile.status}</span>
            <h3>{profile.full_name || "Unnamed user"}</h3>
            <p className="muted">{profile.email || "No email stored"}</p>
            <ProfileStatusControl userId={profile.id} status={profile.status as "draft" | "active" | "suspended" | "archived"} />
          </article>)}
          {!users?.length ? <p className="muted">No users yet.</p> : null}
        </div>
      </div>

      <div className="section">
        <h2>Candidates</h2>
        <div className="grid">
          {(candidates ?? []).map((candidate) => <article className="card" key={candidate.id}>
            <span className="eyebrow">{candidate.status}</span>
            <h3>{candidate.full_name || "Unnamed candidate"}</h3>
            <p className="muted">{candidate.headline || "No headline"}<br />{candidate.location || "Location not provided"}</p>
          </article>)}
          {!candidates?.length ? <p className="muted">No candidates yet.</p> : null}
        </div>
      </div>

      <div className="section">
        <h2>Companies</h2>
        <div className="grid">
          {(companies ?? []).map((company) => <article className="card" key={company.id}>
            <span className="eyebrow">{company.industry || "Company"}</span>
            <h3>{company.name}</h3>
            <p className="muted">{company.location || "Location not provided"}</p>
          </article>)}
          {!companies?.length ? <p className="muted">No companies yet.</p> : null}
        </div>
      </div>

      <div className="section">
        <h2>Roles & moderation</h2>
        <div className="grid">
          {(jobs ?? []).map((job) => {
            const companiesRelation = job.companies as CompanyRelation;
            const companyName = Array.isArray(companiesRelation) ? companiesRelation[0]?.name : companiesRelation?.name;
            return <article className="card" key={job.id}>
              <span className="eyebrow">{job.status}</span>
              <h3>{job.title}</h3>
              <p className="muted">{companyName || "Company"}{job.expires_at ? <><br />Expires {new Date(job.expires_at).toLocaleString()}</> : null}</p>
              <JobModeration jobId={job.id} status={job.status} />
            </article>;
          })}
          {!jobs?.length ? <p className="muted">No jobs yet.</p> : null}
        </div>
      </div>

      <div className="section">
        <h2>Applications & matching</h2>
        <div className="grid">
          {(applications ?? []).map((application) => <article className="card" key={application.id}>
            <span className="eyebrow">{application.status}</span>
            <h3>{application.match_score == null ? "Awaiting review" : application.match_score + "% match signal"}</h3>
            <p className="muted">Candidate: {application.candidate_id}<br />Role: {application.job_id}</p>
            <ApplicationReview applicationId={application.id} matchScore={application.match_score} />
          </article>)}
          {!applications?.length ? <p className="muted">No applications yet.</p> : null}
        </div>
      </div>

      <div className="section">
        <h2>Moderation reports</h2>
        <div className="grid">
          {(reports ?? []).map((report) => <article className="card" key={report.id}>
            <span className="eyebrow">{report.status} · {report.target_type}</span>
            <h3>{report.reason}</h3>
            <p className="muted">Target: {report.target_id}<br />Reported {new Date(report.created_at).toLocaleString()}</p>
            <ReportStatusControl reportId={report.id} status={report.status as "open" | "reviewing" | "resolved" | "dismissed"} />
          </article>)}
          {!reports?.length ? <p className="muted">No moderation reports yet.</p> : null}
        </div>
      </div>

      <div className="section">
        <h2>Audit & security events</h2>
        <div className="grid">
          {(auditLogs ?? []).map((event) => <article className="card" key={event.id}>
            <span className="eyebrow">{event.action}</span>
            <h3>{event.entity_type}</h3>
            <p className="muted">{new Date(event.created_at).toLocaleString()}<br />Entity: {event.entity_id || "n/a"}</p>
          </article>)}
          {!auditLogs?.length ? <p className="muted">No audit events yet.</p> : null}
        </div>
      </div>
    </section>
  </main>;
}

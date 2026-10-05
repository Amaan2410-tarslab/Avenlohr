"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateCompanyApplicationStatus } from "./actions";
import { ReportButton } from "@/app/components/report-button";

type ApplicationStatus = "submitted" | "reviewing" | "shortlisted" | "rejected" | "hired";

type Application = {
  id: string;
  candidate_id: string;
  job_id: string;
  status: ApplicationStatus;
  match_score: number | null;
  created_at: string;
  job_title: string;
  candidate_name: string;
  headline: string | null;
  location: string | null;
  experience_years: number | null;
  seniority: string | null;
  work_mode: string | null;
  industry: string | null;
  skills: string[];
  resume_url: string | null;
};

type Job = { id: string; title: string };

const statuses = ["all", "submitted", "reviewing", "shortlisted", "rejected", "hired"] as const;
type StatusFilter = (typeof statuses)[number];

export default function CompanyApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobFilter, setJobFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.assign("/login");
      return;
    }

    const { data: companyRows, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1);

    if (companyError) {
      setError("Unable to load your company.");
      setLoading(false);
      return;
    }

    const companyId = companyRows?.[0]?.id;
    if (!companyId) {
      setError("Create your company profile before reviewing applicants.");
      setLoading(false);
      return;
    }

    const { data: jobRows, error: jobsError } = await supabase
      .from("jobs")
      .select("id, title")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (jobsError) {
      setError("Unable to load your roles.");
      setLoading(false);
      return;
    }

    const jobData = jobRows ?? [];
    setJobs(jobData);

    const jobIds = jobData.map((job) => job.id);
    if (!jobIds.length) {
      setApplications([]);
      setLoading(false);
      return;
    }

    const { data: applicationRows, error: applicationsError } = await supabase
      .from("applications")
      .select("id, candidate_id, job_id, status, match_score, created_at")
      .in("job_id", jobIds)
      .order("created_at", { ascending: false });

    if (applicationsError) {
      setError("Unable to load applicants.");
      setLoading(false);
      return;
    }

    const rows = applicationRows ?? [];
    const candidateIds = [...new Set(rows.map((row) => row.candidate_id))];

    const profileQuery = candidateIds.length
      ? supabase.from("profiles").select("id, full_name, headline, location").in("id", candidateIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; headline: string | null; location: string | null }[] });

    const candidateQuery = candidateIds.length
      ? supabase.from("candidate_profiles").select("user_id, experience_years, seniority, work_mode, industry, resume_path").in("user_id", candidateIds)
      : Promise.resolve({ data: [] as { user_id: string; experience_years: number | null; seniority: string | null; work_mode: string | null; industry: string | null; resume_path: string | null }[] });

    const skillQuery = candidateIds.length
      ? supabase.from("candidate_skills").select("user_id, skill").in("user_id", candidateIds).order("skill")
      : Promise.resolve({ data: [] as { user_id: string; skill: string }[] });

    const [{ data: profiles }, { data: candidateProfiles }, { data: candidateSkills }] = await Promise.all([
      profileQuery,
      candidateQuery,
      skillQuery,
    ]);

    const profileById = new Map((profiles ?? []).map((item) => [item.id, item]));
    const candidateById = new Map((candidateProfiles ?? []).map((item) => [item.user_id, item]));
    const skillsById = new Map<string, string[]>();

    for (const item of candidateSkills ?? []) {
      skillsById.set(item.user_id, [...(skillsById.get(item.user_id) ?? []), item.skill]);
    }

    const jobById = new Map(jobData.map((job) => [job.id, job.title]));

    const hydrated = await Promise.all(rows.map(async (row) => {
      const candidate = candidateById.get(row.candidate_id);
      const profile = profileById.get(row.candidate_id);
      let resumeUrl: string | null = null;

      if (candidate?.resume_path) {
        const { data: signed } = await supabase.storage
          .from("candidate-documents")
          .createSignedUrl(candidate.resume_path, 300);
        resumeUrl = signed?.signedUrl ?? null;
      }

      return {
        id: row.id,
        candidate_id: row.candidate_id,
        job_id: row.job_id,
        status: row.status as ApplicationStatus,
        match_score: row.match_score,
        created_at: row.created_at,
        job_title: jobById.get(row.job_id) ?? "Role",
        candidate_name: profile?.full_name || "Unnamed candidate",
        headline: profile?.headline ?? null,
        location: profile?.location ?? null,
        experience_years: candidate?.experience_years ?? null,
        seniority: candidate?.seniority ?? null,
        work_mode: candidate?.work_mode ?? null,
        industry: candidate?.industry ?? null,
        skills: skillsById.get(row.candidate_id) ?? [],
        resume_url: resumeUrl,
      };
    }));

    setApplications(hydrated);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () => applications.filter((application) =>
      (jobFilter === "all" || application.job_id === jobFilter)
      && (statusFilter === "all" || application.status === statusFilter),
    ),
    [applications, jobFilter, statusFilter],
  );

  if (loading) {
    return <main className="page"><div className="container hero"><p className="muted">Loading applicants…</p></div></main>;
  }

  return (
    <main className="page">
      <nav className="nav container">
        <span className="brand">AVENLO</span>
        <div className="actions">
          <Link className="btn" href="/company">Company workspace</Link>
        </div>
      </nav>

      <section className="hero container" style={{ maxWidth: 1150 }}>
        <span className="eyebrow">RECRUITER WORKSPACE</span>
        <h1>Review applicants.</h1>
        <p>Candidate information is scoped to people who applied to your roles. Move each application through your hiring workflow without gaining access to unrelated candidate data.</p>

        {error ? <p className="error" role="alert">{error}</p> : null}

        {!error ? (
          <>
            <div className="actions" style={{ marginBottom: 24 }}>
              <label>Role
                <select value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}>
                  <option value="all">All roles</option>
                  {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                </select>
              </label>
              <label>Status
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                  {statuses.map((status) => <option key={status} value={status}>{status === "all" ? "All statuses" : status}</option>)}
                </select>
              </label>
            </div>

            <div className="grid">
              {filtered.map((application) => (
                <ApplicantCard key={application.id} application={application} onUpdated={load} />
              ))}
              {!filtered.length ? <p className="muted">No applicants match the selected filters.</p> : null}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}

function ApplicantCard({
  application,
  onUpdated,
}: {
  application: Application;
  onUpdated: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function changeStatus(status: ApplicationStatus) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateCompanyApplicationStatus({
        applicationId: application.id,
        status,
      });
      setMessage(result.message);
      if (result.ok) await onUpdated();
    });
  }

  return (
    <article className="card">
      <span className="eyebrow">{application.status} · {application.job_title}</span>
      <h2>{application.candidate_name}</h2>
      <p className="muted">
        {application.headline || "No headline provided"}<br />
        {application.location || "Location not provided"}
      </p>
      <p>
        <strong>Experience:</strong> {application.experience_years == null ? "Not provided" : application.experience_years + " years"}
        {" · "}
        <strong>Seniority:</strong> {application.seniority || "Not provided"}
      </p>
      <p>
        <strong>Work mode:</strong> {application.work_mode || "Not provided"}
        {" · "}
        <strong>Industry:</strong> {application.industry || "Not provided"}
      </p>
      <p><strong>Skills:</strong> {application.skills.length ? application.skills.join(", ") : "Not provided"}</p>
      {application.match_score != null ? <p><strong>Match signal:</strong> {application.match_score}%</p> : null}
      {application.resume_url ? <p><a href={application.resume_url} target="_blank" rel="noreferrer">View CV</a></p> : null}

      <div className="actions">
        <label>Status
          <select
            value={application.status}
            onChange={(event) => changeStatus(event.target.value as ApplicationStatus)}
            disabled={pending}
          >
            <option value="submitted">Submitted</option>
            <option value="reviewing">Reviewing</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="rejected">Rejected</option>
            <option value="hired">Hired</option>
          </select>
        </label>
        {pending ? <span className="muted">Updating…</span> : null}
        <ReportButton targetType="candidate" targetId={application.candidate_id} />
      </div>
      {message ? <p className="muted" role="status">{message}</p> : null}
    </article>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Application = {
  id: string;
  status: string;
  match_score: number | null;
  created_at: string;
  job_title: string;
  company_name: string;
};

export default function CandidateApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role !== "candidate") {
        window.location.assign("/dashboard");
        return;
      }

      const { data: rows, error: applicationsError } = await supabase
        .from("applications")
        .select("id, status, match_score, created_at, jobs!inner(title, companies!inner(name, owner_id))")
        .eq("candidate_id", user.id)
        .order("created_at", { ascending: false });

      if (applicationsError) {
        setError("Unable to load your applications.");
        setLoading(false);
        return;
      }

      const mapped = (rows ?? []).map((row) => {
        const jobs = row.jobs as { title?: string; companies?: { name?: string } | { name?: string }[] } | { title?: string; companies?: { name?: string } }[];
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        const companies = job?.companies;
        const company = Array.isArray(companies) ? companies[0] : companies;

        return {
          id: row.id,
          status: row.status,
          match_score: row.match_score,
          created_at: row.created_at,
          job_title: job?.title ?? "Role",
          company_name: company?.name ?? "Company",
        };
      });

      setApplications(mapped);
      setLoading(false);
    }

    void load();
  }, []);

  if (loading) {
    return <main className="page"><div className="container hero"><p className="muted">Loading your applications…</p></div></main>;
  }

  return (
    <main className="page">
      <nav className="nav container">
        <span className="brand">AVENLO</span>
        <div className="actions">
          <Link className="btn" href="/dashboard">Dashboard</Link>
          <Link className="btn" href="/dashboard/jobs">Browse roles</Link>
        </div>
      </nav>

      <section className="hero container" style={{ maxWidth: 1000 }}>
        <span className="eyebrow">APPLICATIONS</span>
        <h1>Track your applications.</h1>
        <p>Your application decisions are controlled by the Avenlo review workflow. You can always see the current status of your own submissions.</p>

        {error ? <p className="error" role="alert">{error}</p> : null}

        <div className="grid">
          {applications.map((application) => (
            <article className="card" key={application.id}>
              <span className="eyebrow">{application.status}</span>
              <h2>{application.job_title}</h2>
              <p className="muted">{application.company_name}</p>
              <p>
                <strong>Applied:</strong> {new Date(application.created_at).toLocaleDateString()}
                {" · "}
                <strong>Match signal:</strong> {application.match_score == null ? "Awaiting review" : application.match_score + "%"}
              </p>
            </article>
          ))}
          {!applications.length && !error ? <p className="muted">You have not applied to any roles yet.</p> : null}
        </div>
      </section>
    </main>
  );
}

"use client";

import { useState, useTransition } from "react";
import { applyToJob } from "./actions";

export function JobCard({ job, applied }: { job: { id: string; title: string; description: string; location: string | null; work_mode: string | null; seniority: string | null; experience_years: number | null; company_name: string | null }; applied: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(applied ? "Already applied" : null);

  function apply() {
    setMessage(null);
    startTransition(async () => {
      const result = await applyToJob(job.id);
      setMessage(result.message);
    });
  }

  return <article className="card">
    <span className="eyebrow">{job.company_name || "Avenlo company"}</span>
    <h2>{job.title}</h2>
    <p className="muted">{job.description}</p>
    <p className="muted">{job.location || "Location flexible"} · {job.work_mode || "Work mode flexible"} · {job.seniority || "Any seniority"} · {job.experience_years == null ? "Experience flexible" : `${job.experience_years}+ years`}</p>
    <button className="btn primary" type="button" onClick={apply} disabled={pending || applied}>{pending ? "Applying…" : applied ? "Applied" : "Apply"}</button>
    {message ? <p className="muted" role="status">{message}</p> : null}
  </article>;
}

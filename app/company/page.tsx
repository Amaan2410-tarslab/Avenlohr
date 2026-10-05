"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "@/app/components/sign-out-button";

type Company = { id: string; name: string; website: string | null; industry: string | null; location: string | null; description: string | null };
type Job = {
  id: string;
  title: string;
  description: string;
  skills: string[];
  status: string;
  location: string | null;
  work_mode: string | null;
  seniority: string | null;
  experience_years: number | null;
  industry: string | null;
  expires_at: string | null;
  created_at: string;
};

type JobFormState = {
  title: string;
  description: string;
  skills: string;
  experience_years: string;
  seniority: string;
  location: string;
  work_mode: string;
  industry: string;
  expires_at: string;
};

const emptyJobForm = (): JobFormState => ({
  title: "",
  description: "",
  skills: "",
  experience_years: "",
  seniority: "",
  location: "",
  work_mode: "",
  industry: "",
  expires_at: "",
});

export default function CompanyPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({ name: "", website: "", industry: "", location: "", description: "" });
  const [jobForm, setJobForm] = useState<JobFormState>(emptyJobForm());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.assign("/login"); return; }

    const { data: companies, error: companyError } = await supabase
      .from("companies")
      .select("id, name, website, industry, location, description")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (companyError) { setError("Unable to load company workspace."); setLoading(false); return; }

    const current = companies?.[0] ?? null;
    setCompany(current);

    if (current) {
      const { data: jobData, error: jobsError } = await supabase
        .from("jobs")
        .select("id, title, description, skills, status, location, work_mode, seniority, experience_years, industry, expires_at, created_at")
        .eq("company_id", current.id)
        .order("created_at", { ascending: false });

      if (jobsError) setError("Unable to load roles.");
      setJobs((jobData ?? []) as Job[]);
    }

    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired.");

      const { data, error: saveError } = await supabase
        .from("companies")
        .insert({ owner_id: user.id, ...companyForm })
        .select("id, name, website, industry, location, description")
        .single();

      if (saveError) throw new Error("Unable to create company profile.");

      setCompany(data);
      setMessage("Company profile created.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save company.");
    } finally {
      setSaving(false);
    }
  }

  function editJob(job: Job) {
    setEditingJobId(job.id);
    setMessage(null);
    setError(null);
    setJobForm({
      title: job.title,
      description: job.description,
      skills: job.skills.join(", "),
      experience_years: job.experience_years == null ? "" : String(job.experience_years),
      seniority: job.seniority ?? "",
      location: job.location ?? "",
      work_mode: job.work_mode ?? "",
      industry: job.industry ?? company?.industry ?? "",
      expires_at: job.expires_at ? new Date(job.expires_at).toISOString().slice(0, 16) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetJobForm() {
    setEditingJobId(null);
    setJobForm(emptyJobForm());
  }

  async function saveJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company) return;

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const mode = submitter?.value === "draft" ? "draft" : "review";

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired.");

      const skills = [...new Set(jobForm.skills.split(",").map((skill) => skill.trim().toLowerCase()).filter(Boolean))];
      const experienceYears = jobForm.experience_years ? Number(jobForm.experience_years) : null;

      if (experienceYears != null && (!Number.isFinite(experienceYears) || experienceYears < 0 || experienceYears > 60)) {
        throw new Error("Experience must be between 0 and 60 years.");
      }
      if (!jobForm.title.trim() || !jobForm.description.trim()) {
        throw new Error("Job title and description are required.");
      }

      const expiresAt = jobForm.expires_at ? new Date(jobForm.expires_at).toISOString() : null;
      if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
        throw new Error("Expiry must be in the future.");
      }

      const payload = {
        company_id: company.id,
        created_by: user.id,
        title: jobForm.title.trim(),
        description: jobForm.description.trim(),
        skills,
        experience_years: experienceYears,
        seniority: jobForm.seniority.trim() || null,
        location: jobForm.location.trim() || null,
        work_mode: jobForm.work_mode.trim() || null,
        industry: jobForm.industry.trim() || company.industry || null,
        expires_at: expiresAt,
        status: mode === "draft" ? "draft" : "pending_review",
      };

      const result = editingJobId
        ? await supabase.from("jobs").update(payload).eq("id", editingJobId).eq("company_id", company.id)
        : await supabase.from("jobs").insert(payload);

      if (result.error) throw new Error(editingJobId ? "Unable to save role changes." : "Unable to submit role.");

      setMessage(
        mode === "draft"
          ? (editingJobId ? "Role saved as a draft." : "Role saved as a draft.")
          : (editingJobId ? "Role updated and submitted for review." : "Role submitted for Avenlo review."),
      );
      resetJobForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save role.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteJob(job: Job) {
    if (!company || !["draft", "pending_review"].includes(job.status)) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("jobs")
        .delete()
        .eq("id", job.id)
        .eq("company_id", company.id);

      if (deleteError) throw new Error("Unable to delete role.");
      setMessage("Draft role deleted.");
      if (editingJobId === job.id) resetJobForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete role.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="page"><div className="container hero"><p className="muted">Loading company workspace…</p></div></main>;

  return <main className="page">
    <nav className="nav container">
      <span className="brand">AVENLO</span>
      <div className="actions">
        <Link className="btn" href="/">Home</Link>
        {company ? <Link className="btn" href="/company/applications">Review applicants</Link> : null}
        <SignOutButton />
      </div>
    </nav>

    <section className="hero container" style={{ maxWidth: 1000 }}>
      <span className="eyebrow">COMPANY WORKSPACE</span>
      <h1>{company ? company.name : "Set up your company."}</h1>
      <p>Describe your organisation and submit structured requirements. Roles are reviewed by Avenlo before candidates can see them.</p>

      {!company ? <form className="card form" onSubmit={saveCompany}>
        <label>Company name<input required value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} /></label>
        <label>Website<input type="url" value={companyForm.website} onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })} placeholder="https://" /></label>
        <label>Industry<input value={companyForm.industry} onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })} /></label>
        <label>Location<input value={companyForm.location} onChange={(e) => setCompanyForm({ ...companyForm, location: e.target.value })} /></label>
        <label>Description<input value={companyForm.description} onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })} /></label>
        <button className="btn primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Create company"}</button>
      </form> : <>
        <form className="card form" onSubmit={saveJob}>
          <div className="actions" style={{ justifyContent: "space-between", marginTop: 0 }}>
            <h2>{editingJobId ? "Edit role" : "Create a role"}</h2>
            {editingJobId ? <button className="btn" type="button" onClick={resetJobForm}>New role</button> : null}
          </div>
          <label>Job title<input required value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} /></label>
          <label>Role description<input required value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} /></label>
          <label>Skills <span className="muted">comma separated</span><input value={jobForm.skills} onChange={(e) => setJobForm({ ...jobForm, skills: e.target.value })} placeholder="Python, SQL, Data Analysis" /></label>
          <div className="grid">
            <label>Experience years<input type="number" min="0" max="60" step="0.5" value={jobForm.experience_years} onChange={(e) => setJobForm({ ...jobForm, experience_years: e.target.value })} /></label>
            <label>Seniority<input value={jobForm.seniority} onChange={(e) => setJobForm({ ...jobForm, seniority: e.target.value })} placeholder="Junior / Mid / Senior / Lead" /></label>
            <label>Work mode<input value={jobForm.work_mode} onChange={(e) => setJobForm({ ...jobForm, work_mode: e.target.value })} placeholder="Remote / Hybrid / On-site" /></label>
          </div>
          <label>Location<input value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} placeholder="Hyderabad, Telangana" /></label>
          <label>Industry<input value={jobForm.industry} onChange={(e) => setJobForm({ ...jobForm, industry: e.target.value })} /></label>
          <label>Expiry<input type="datetime-local" value={jobForm.expires_at} onChange={(e) => setJobForm({ ...jobForm, expires_at: e.target.value })} /></label>
          <div className="actions" style={{ marginTop: 4 }}>
            <button className="btn" type="submit" value="draft" disabled={saving}>{saving ? "Saving…" : "Save draft"}</button>
            <button className="btn primary" type="submit" value="review" disabled={saving}>{saving ? "Saving…" : editingJobId ? "Save & submit for review" : "Submit for review"}</button>
          </div>
        </form>

        {message ? <p className="muted" role="status">{message}</p> : null}
        {error ? <p className="error" role="alert">{error}</p> : null}

        <div className="section">
          <h2>Roles</h2>
          <div className="grid">
            {jobs.length ? jobs.map((job) => (
              <article className="card" key={job.id}>
                <span className="eyebrow">{job.status}</span>
                <h3>{job.title}</h3>
                <p className="muted">{job.location || "Location flexible"} · {job.work_mode || "Work mode to be discussed"}</p>
                {job.expires_at ? <p className="muted">Expires {new Date(job.expires_at).toLocaleString()}</p> : null}
                <div className="actions">
                  <button className="btn" type="button" onClick={() => editJob(job)} disabled={saving}>Edit</button>
                  {["draft", "pending_review"].includes(job.status) ? <button className="btn" type="button" onClick={() => deleteJob(job)} disabled={saving}>Delete</button> : null}
                </div>
              </article>
            )) : <p className="muted">No roles submitted yet.</p>}
          </div>
        </div>
      </>}
      {error && !company ? <p className="error" role="alert">{error}</p> : null}
    </section>
  </main>;
}

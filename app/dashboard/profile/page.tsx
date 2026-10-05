"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string;
  phone: string;
  headline: string;
  location: string;
  bio: string;
};

type Candidate = {
  experience_years: number | null;
  seniority: string;
  work_mode: string;
  industry: string;
  resume_path: string | null;
  preferences: Record<string, unknown>;
};

type Education = {
  id?: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_year: number | null;
  end_year: number | null;
  currently_studying: boolean;
};

const emptyEducation = (): Education => ({
  institution: "",
  degree: "",
  field_of_study: "",
  start_year: null,
  end_year: null,
  currently_studying: false,
});

export default function CandidateProfilePage() {
  const [profile, setProfile] = useState<Profile>({ full_name: "", phone: "", headline: "", location: "", bio: "" });
  const [candidate, setCandidate] = useState<Candidate>({ experience_years: null, seniority: "", work_mode: "", industry: "", resume_path: null, preferences: {} });
  const [education, setEducation] = useState<Education[]>([]);
  const [skills, setSkills] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.assign("/login"); return; }

      const [{ data: profileData, error: profileError }, { data: candidateData }, { data: skillData }, { data: educationData }] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, headline, location, bio").eq("id", user.id).single(),
        supabase.from("candidate_profiles").select("experience_years, seniority, work_mode, industry, resume_path, preferences").eq("user_id", user.id).maybeSingle(),
        supabase.from("candidate_skills").select("skill").eq("user_id", user.id).order("skill"),
        supabase.from("candidate_education").select("id, institution, degree, field_of_study, start_year, end_year, currently_studying").eq("user_id", user.id).order("start_year", { ascending: false }),
      ]);

      if (profileError) setError("Unable to load your profile.");
      if (profileData) setProfile((current) => ({ ...current, ...profileData }));
      if (candidateData) setCandidate(candidateData as Candidate);
      setSkills((skillData ?? []).map((item) => item.skill).join(", "));
      setEducation((educationData ?? []).map((item) => ({
        id: item.id,
        institution: item.institution ?? "",
        degree: item.degree ?? "",
        field_of_study: item.field_of_study ?? "",
        start_year: item.start_year ?? null,
        end_year: item.end_year ?? null,
        currently_studying: Boolean(item.currently_studying),
      })));
      setLoading(false);
    }
    void load();
  }, []);

  function updateEducation(index: number, patch: Partial<Education>) {
    setEducation((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function validateEducation(rows: Education[]) {
    for (const row of rows) {
      if (!row.institution.trim()) throw new Error("Each education entry needs an institution.");
      if (row.start_year != null && (row.start_year < 1900 || row.start_year > 2100)) throw new Error("Education start year must be between 1900 and 2100.");
      if (row.end_year != null && (row.end_year < 1900 || row.end_year > 2100)) throw new Error("Education end year must be between 1900 and 2100.");
      if (row.start_year != null && row.end_year != null && row.end_year < row.start_year) throw new Error("Education end year cannot be before the start year.");
      if (row.currently_studying) row.end_year = null;
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired. Please sign in again.");

      if (candidate.experience_years != null && (!Number.isFinite(candidate.experience_years) || candidate.experience_years < 0 || candidate.experience_years > 60)) {
        throw new Error("Years of experience must be between 0 and 60.");
      }

      const educationRows = education.map((row) => ({ ...row }));
      validateEducation(educationRows);

      let resumePath = candidate.resume_path;
      if (resume) {
        if (resume.size > 10 * 1024 * 1024) throw new Error("CV must be 10 MB or smaller.");
        const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
        if (!allowed.includes(resume.type)) throw new Error("Upload a PDF, DOC, or DOCX CV.");
        const extension = resume.name.split(".").pop()?.toLowerCase();
        if (!extension || !["pdf", "doc", "docx"].includes(extension)) throw new Error("Upload a PDF, DOC, or DOCX CV.");
        const newResumePath = user.id + "/resume." + extension;
        const { error: uploadError } = await supabase.storage.from("candidate-documents").upload(newResumePath, resume, { upsert: true, contentType: resume.type });
        if (uploadError) throw new Error("Unable to upload CV.");
        resumePath = newResumePath;
      }

      const { error: profileError } = await supabase.from("profiles").update({
        full_name: profile.full_name.trim(),
        phone: profile.phone.trim(),
        headline: profile.headline.trim(),
        location: profile.location.trim(),
        bio: profile.bio.trim(),
      }).eq("id", user.id);
      if (profileError) throw new Error("Unable to save profile details.");

      const { error: candidateError } = await supabase.from("candidate_profiles").upsert({
        user_id: user.id,
        experience_years: candidate.experience_years,
        seniority: candidate.seniority.trim() || null,
        work_mode: candidate.work_mode.trim() || null,
        industry: candidate.industry.trim() || null,
        resume_path: resumePath,
        preferences: candidate.preferences,
      });
      if (candidateError) throw new Error("Unable to save professional details.");

      const skillList = [...new Set(skills.split(",").map((skill) => skill.trim().toLowerCase()).filter(Boolean))];
      const { error: deleteError } = await supabase.from("candidate_skills").delete().eq("user_id", user.id);
      if (deleteError) throw new Error("Unable to update skills.");
      if (skillList.length) {
        const { error: skillError } = await supabase.from("candidate_skills").insert(skillList.map((skill) => ({ user_id: user.id, skill })));
        if (skillError) throw new Error("Unable to update skills.");
      }

      const { data: existingEducation } = await supabase.from("candidate_education").select("id").eq("user_id", user.id);
      const keptIds = new Set(educationRows.flatMap((row) => row.id ? [row.id] : []));
      const idsToDelete = (existingEducation ?? []).map((row) => row.id).filter((id) => !keptIds.has(id));
      if (idsToDelete.length) {
        const { error: educationDeleteError } = await supabase.from("candidate_education").delete().in("id", idsToDelete);
        if (educationDeleteError) throw new Error("Unable to update education.");
      }

      if (educationRows.length) {
        const payload = educationRows.map((row) => ({
          ...(row.id ? { id: row.id } : {}),
          user_id: user.id,
          institution: row.institution.trim(),
          degree: row.degree.trim() || null,
          field_of_study: row.field_of_study.trim() || null,
          start_year: row.start_year,
          end_year: row.currently_studying ? null : row.end_year,
          currently_studying: row.currently_studying,
        }));
        const { data: savedEducation, error: educationError } = await supabase.from("candidate_education").upsert(payload).select("id, institution, degree, field_of_study, start_year, end_year, currently_studying");
        if (educationError) throw new Error("Unable to update education.");
        setEducation((savedEducation ?? []).map((row) => ({
          id: row.id,
          institution: row.institution ?? "",
          degree: row.degree ?? "",
          field_of_study: row.field_of_study ?? "",
          start_year: row.start_year ?? null,
          end_year: row.end_year ?? null,
          currently_studying: Boolean(row.currently_studying),
        })));
      } else {
        setEducation([]);
      }

      setCandidate((current) => ({ ...current, resume_path: resumePath }));
      setResume(null);
      setMessage("Profile saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="page"><div className="container hero"><p className="muted">Loading your profile…</p></div></main>;

  return <main className="page">
    <nav className="nav container"><span className="brand">AVENLO</span><div className="actions"><Link className="btn" href="/dashboard">Dashboard</Link><Link className="btn" href="/dashboard/applications">Applications</Link></div></nav>
    <section className="hero container" style={{ maxWidth: 900 }}>
      <span className="eyebrow">CANDIDATE PROFILE</span>
      <h1>Your professional profile.</h1>
      <p>Give the Avenlo team enough structured information to understand your experience and surface relevant opportunities.</p>
      <form className="card form" onSubmit={save}>
        <label>Full name<input required value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></label>
        <label>Phone<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label>
        <label>Professional headline<input value={profile.headline} onChange={(e) => setProfile({ ...profile, headline: e.target.value })} placeholder="e.g. Product Manager — B2B SaaS" /></label>
        <label>Location<input value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} /></label>
        <label>Professional summary<input value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} /></label>
        <label>Years of experience<input type="number" min="0" max="60" step="0.5" value={candidate.experience_years ?? ""} onChange={(e) => setCandidate({ ...candidate, experience_years: e.target.value ? Number(e.target.value) : null })} /></label>
        <label>Seniority<input value={candidate.seniority} onChange={(e) => setCandidate({ ...candidate, seniority: e.target.value })} placeholder="Junior / Mid / Senior / Lead / Executive" /></label>
        <label>Preferred work mode<input value={candidate.work_mode} onChange={(e) => setCandidate({ ...candidate, work_mode: e.target.value })} placeholder="Remote / Hybrid / On-site" /></label>
        <label>Industry<input value={candidate.industry} onChange={(e) => setCandidate({ ...candidate, industry: e.target.value })} /></label>
        <label>Skills <span className="muted">comma separated</span><input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Product Management, SQL" /></label>

        <div className="section">
          <div className="actions" style={{ justifyContent: "space-between" }}>
            <div><span className="eyebrow">EDUCATION</span><h2>Education history</h2></div>
            <button className="btn" type="button" onClick={() => setEducation((rows) => [...rows, emptyEducation()])}>Add education</button>
          </div>
          {education.map((row, index) => (
            <div className="card" key={row.id ?? "new-" + index} style={{ marginTop: 16 }}>
              <div className="actions" style={{ justifyContent: "space-between" }}>
                <strong>Education {index + 1}</strong>
                <button className="btn" type="button" onClick={() => setEducation((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</button>
              </div>
              <label>Institution<input required value={row.institution} onChange={(e) => updateEducation(index, { institution: e.target.value })} placeholder="University / College" /></label>
              <label>Degree<input value={row.degree} onChange={(e) => updateEducation(index, { degree: e.target.value })} placeholder="B.Sc. Computer Science" /></label>
              <label>Field of study<input value={row.field_of_study} onChange={(e) => updateEducation(index, { field_of_study: e.target.value })} /></label>
              <div className="grid">
                <label>Start year<input type="number" min="1900" max="2100" value={row.start_year ?? ""} onChange={(e) => updateEducation(index, { start_year: e.target.value ? Number(e.target.value) : null })} /></label>
                <label>End year<input type="number" min="1900" max="2100" value={row.end_year ?? ""} disabled={row.currently_studying} onChange={(e) => updateEducation(index, { end_year: e.target.value ? Number(e.target.value) : null })} /></label>
              </div>
              <label><input type="checkbox" checked={row.currently_studying} onChange={(e) => updateEducation(index, { currently_studying: e.target.checked, end_year: e.target.checked ? null : row.end_year })} /> Currently studying</label>
            </div>
          ))}
          {!education.length ? <p className="muted">Add your degree, college and field of study so matching can use education as a signal.</p> : null}
        </div>

        <label>CV / Resume<input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setResume(e.target.files?.[0] ?? null)} /></label>
        {candidate.resume_path ? <p className="muted">A CV is already stored securely. Upload a new one only if you want to replace it.</p> : null}
        {error ? <p className="error" role="alert">{error}</p> : null}
        {message ? <p className="muted" role="status">{message}</p> : null}
        <button className="btn primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
      </form>
    </section>
  </main>;
}

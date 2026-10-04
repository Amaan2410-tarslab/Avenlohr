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

export default function CandidateProfilePage() {
  const [profile, setProfile] = useState<Profile>({ full_name: "", phone: "", headline: "", location: "", bio: "" });
  const [candidate, setCandidate] = useState<Candidate>({ experience_years: null, seniority: "", work_mode: "", industry: "", resume_path: null, preferences: {} });
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

      const [{ data: profileData, error: profileError }, { data: candidateData }, { data: skillData }] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, headline, location, bio").eq("id", user.id).single(),
        supabase.from("candidate_profiles").select("experience_years, seniority, work_mode, industry, resume_path, preferences").eq("user_id", user.id).maybeSingle(),
        supabase.from("candidate_skills").select("skill").eq("user_id", user.id).order("skill"),
      ]);

      if (profileError) setError("Unable to load your profile.");
      if (profileData) setProfile({ ...profile, ...profileData });
      if (candidateData) setCandidate(candidateData as Candidate);
      setSkills((skillData ?? []).map((item) => item.skill).join(", "));
      setLoading(false);
    }
    void load();
  }, []);

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

      let resumePath = candidate.resume_path;
      let newResumePath: string | null = null;
      if (resume) {
        if (resume.size > 10 * 1024 * 1024) throw new Error("CV must be 10 MB or smaller.");
        const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
        if (!allowed.includes(resume.type)) throw new Error("Upload a PDF, DOC, or DOCX CV.");
        const extension = resume.name.split(".").pop()?.toLowerCase();
        if (!extension || !["pdf", "doc", "docx"].includes(extension)) throw new Error("Upload a PDF, DOC, or DOCX CV.");
        newResumePath = `${user.id}/resume.${extension}`;
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
    <nav className="nav container"><span className="brand">AVENLO</span><div className="actions"><Link className="btn" href="/dashboard">Dashboard</Link></div></nav>
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
        <label>CV / Resume<input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setResume(e.target.files?.[0] ?? null)} /></label>
        {candidate.resume_path ? <p className="muted">A CV is already stored securely. Upload a new one only if you want to replace it.</p> : null}
        {error ? <p className="error" role="alert">{error}</p> : null}
        {message ? <p className="muted" role="status">{message}</p> : null}
        <button className="btn primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
      </form>
    </section>
  </main>;
}

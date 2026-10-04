"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { explainMatch } from "@/lib/matching";

const jobActionSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["open", "closed", "paused"]),
});

const applicationMatchSchema = z.object({
  applicationId: z.string().uuid(),
});

const profileStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["draft", "active", "suspended", "archived"]),
});

export async function moderateJob(input: { jobId: string; status: "open" | "closed" | "paused" }) {
  const parsed = jobActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid moderation request." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "staff" && profile?.role !== "founder") return { ok: false, message: "Not authorized." };

  const { error } = await supabase.from("jobs").update({ status: parsed.data.status }).eq("id", parsed.data.jobId);
  if (error) return { ok: false, message: "Unable to update role status." };

  return { ok: true, message: "Role marked " + parsed.data.status + "." };
}

export async function calculateApplicationMatch(input: { applicationId: string }) {
  const parsed = applicationMatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid application." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "staff" && profile?.role !== "founder") {
    return { ok: false, message: "Not authorized." };
  }

  const { data: application } = await supabase
    .from("applications")
    .select("id, candidate_id, job_id")
    .eq("id", parsed.data.applicationId)
    .maybeSingle();

  if (!application) return { ok: false, message: "Application not found." };

  const [{ data: job }, { data: candidate }, { data: candidateProfile }, { data: skills }] = await Promise.all([
    supabase.from("jobs").select("skills, experience_years, seniority, location, work_mode, industry").eq("id", application.job_id).maybeSingle(),
    supabase.from("candidate_profiles").select("experience_years, seniority, work_mode, industry").eq("user_id", application.candidate_id).maybeSingle(),
    supabase.from("profiles").select("location").eq("id", application.candidate_id).maybeSingle(),
    supabase.from("candidate_skills").select("skill").eq("user_id", application.candidate_id),
  ]);

  if (!job) return { ok: false, message: "Role requirements not found." };
  if (!candidate) return { ok: false, message: "Candidate profile is incomplete." };

  const result = explainMatch(
    {
      skills: job.skills ?? [],
      experienceYears: job.experience_years ?? undefined,
      seniority: job.seniority ?? undefined,
      location: job.location ?? undefined,
      workMode: job.work_mode ?? undefined,
      industry: job.industry ?? undefined,
    },
    {
      skills: (skills ?? []).map((item) => item.skill),
      experienceYears: candidate.experience_years ?? undefined,
      seniority: candidate.seniority ?? undefined,
      location: candidateProfile?.location ?? undefined,
      workMode: candidate.work_mode ?? undefined,
      industry: candidate.industry ?? undefined,
    },
  );

  const { error } = await supabase
    .from("applications")
    .update({
      match_score: result.score,
      match_explanation: result,
    })
    .eq("id", application.id);

  if (error) return { ok: false, message: "Unable to store match result." };

  return { ok: true, message: "Match calculated at " + result.score + "%.", score: result.score };
}

export async function setProfileStatus(input: {
  userId: string;
  status: "draft" | "active" | "suspended" | "archived";
}) {
  const parsed = profileStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid account status." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  if (user.id === parsed.data.userId) return { ok: false, message: "You cannot change your own account status." };

  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (actor?.role !== "staff" && actor?.role !== "founder") {
    return { ok: false, message: "Not authorized." };
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", parsed.data.userId)
    .maybeSingle();

  if (!target) return { ok: false, message: "User not found." };
  if (actor.role === "staff" && !["candidate", "company"].includes(target.role)) {
    return { ok: false, message: "Staff cannot change privileged account status." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.userId);

  if (error) return { ok: false, message: "Unable to update account status." };

  return { ok: true, message: "Account marked " + parsed.data.status + "." };
}

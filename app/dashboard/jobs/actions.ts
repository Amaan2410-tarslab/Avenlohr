"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const jobIdSchema = z.string().uuid();

export async function applyToJob(jobId: string) {
  const parsed = jobIdSchema.safeParse(jobId);
  if (!parsed.success) return { ok: false, message: "Invalid role." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "candidate") return { ok: false, message: "Only candidate accounts can apply." };

  const { error } = await supabase.from("applications").insert({ job_id: parsed.data, candidate_id: user.id });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "You have already applied to this role." };
    return { ok: false, message: "Unable to submit the application." };
  }

  return { ok: true, message: "Application submitted for human review." };
}

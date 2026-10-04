"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const jobActionSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["open", "closed", "paused"]),
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
  return { ok: true, message: `Role marked ${parsed.data.status}.` };
}

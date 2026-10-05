"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const reportSchema = z.object({
  targetType: z.enum(["job", "candidate", "company", "application"]),
  targetId: z.string().uuid(),
  reason: z.string().trim().min(10).max(2000),
});

export async function submitReport(input: {
  targetType: "job" | "candidate" | "company" | "application";
  targetId: string;
  reason: string;
}) {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Provide a valid report reason." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status === "suspended") return { ok: false, message: "This account cannot submit reports." };

  let targetExists: boolean;

  if (parsed.data.targetType === "job") {
    const { data } = await supabase.from("jobs").select("id").eq("id", parsed.data.targetId).maybeSingle();
    targetExists = Boolean(data);
  } else if (parsed.data.targetType === "candidate") {
    const { data } = await supabase.from("profiles").select("id").eq("id", parsed.data.targetId).maybeSingle();
    targetExists = Boolean(data);
  } else if (parsed.data.targetType === "company") {
    const { data } = await supabase.from("companies").select("id").eq("id", parsed.data.targetId).maybeSingle();
    targetExists = Boolean(data);
  } else {
    const { data } = await supabase.from("applications").select("id").eq("id", parsed.data.targetId).maybeSingle();
    targetExists = Boolean(data);
  }

  if (!targetExists) return { ok: false, message: "That item is no longer available for reporting." };

  const { error } = await supabase.from("moderation_reports").insert({
    reporter_id: user.id,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
  });

  if (error?.code === "23505") {
    return { ok: false, message: "You already have an open report for this item." };
  }

  if (error) return { ok: false, message: "Unable to submit report." };

  return { ok: true, message: "Report submitted to Avenlo moderation." };
}

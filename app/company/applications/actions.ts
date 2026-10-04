"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(["submitted", "reviewing", "shortlisted", "rejected", "hired"]),
});

export async function updateCompanyApplicationStatus(input: {
  applicationId: string;
  status: "submitted" | "reviewing" | "shortlisted" | "rejected" | "hired";
}) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid application update." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "company") return { ok: false, message: "Not authorized." };

  const { data: application } = await supabase
    .from("applications")
    .select("id, job_id")
    .eq("id", parsed.data.applicationId)
    .maybeSingle();

  if (!application) return { ok: false, message: "Application not found." };

  const { data: ownedJob } = await supabase
    .from("jobs")
    .select("id, companies!inner(owner_id)")
    .eq("id", application.job_id)
    .eq("companies.owner_id", user.id)
    .maybeSingle();

  if (!ownedJob) return { ok: false, message: "You do not own this application." };

  const { error } = await supabase
    .from("applications")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.applicationId);

  if (error) return { ok: false, message: "Unable to update application status." };

  return { ok: true, message: "Application marked " + parsed.data.status + "." };
}

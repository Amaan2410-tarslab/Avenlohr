import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectPath = requestUrl.searchParams.get("redirect") || "/dashboard";
  const safeRedirect = redirectPath.startsWith("/") && !redirectPath.startsWith("//") ? redirectPath : "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("verification_failed")}`, requestUrl.origin));
  }

  return NextResponse.redirect(new URL(safeRedirect, requestUrl.origin));
}

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/");
  }

  return <button className="btn" type="button" onClick={signOut} disabled={loading}>{loading ? "Signing out…" : "Sign out"}</button>;
}

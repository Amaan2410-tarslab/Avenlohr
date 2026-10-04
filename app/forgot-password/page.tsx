"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (resetError) throw resetError;
      setMessage("If that email belongs to an Avenlo account, a password reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request a password reset.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="page"><div className="container hero" style={{ maxWidth: 720 }}><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Reset your password.</h1><form className="card form" onSubmit={submit}><label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>{error ? <p className="error" role="alert">{error}</p> : null}{message ? <p className="muted" role="status">{message}</p> : null}<button className="btn primary" type="submit" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button><p className="muted"><Link href="/login">Back to sign in</Link></p></form></div></main>;
}

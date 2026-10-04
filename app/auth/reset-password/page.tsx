"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ error: userError }) => {
      if (userError) setError("This reset link is invalid or has expired.");
      else setReady(true);
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage("Password updated. Redirecting to your dashboard…");
    setTimeout(() => router.push("/dashboard"), 800);
  }

  return <main className="page"><div className="container hero" style={{ maxWidth: 720 }}><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Choose a new password.</h1>{ready ? <form className="card form" onSubmit={submit}><label>New password<input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error ? <p className="error" role="alert">{error}</p> : null}{message ? <p className="muted" role="status">{message}</p> : null}<button className="btn primary" type="submit">Update password</button></form> : <p className="muted">{error || "Checking reset link…"}</p>}</div></main>;
}

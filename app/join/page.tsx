"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Join() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"candidate" | "company">("candidate");
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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, account_type: accountType } },
      });
      if (signUpError) throw signUpError;
      if (data.session) {
        window.location.assign(accountType === "company" ? "/company" : "/dashboard/profile");
        return;
      }
      setMessage("Account created. Check your email to verify your address, then sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="container hero" style={{ maxWidth: 820 }}>
        <span className="eyebrow">JOIN AVENLO</span>
        <h1>Build your place in the talent network.</h1>
        <p>Avenlo connects private professional profiles with company requirements while keeping matching human-led.</p>
        <form className="card form" onSubmit={submit}>
          <label>Account type
            <select value={accountType} onChange={(event) => setAccountType(event.target.value as "candidate" | "company")}>
              <option value="candidate">Candidate — I want relevant opportunities</option>
              <option value="company">Company — I want to hire talent</option>
            </select>
          </label>
          <label>Full name<input required autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
          <label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error ? <p className="error" role="alert">{error}</p> : null}
          {message ? <p className="muted" role="status">{message}</p> : null}
          <button className="btn primary" type="submit" disabled={loading}>{loading ? "Creating account…" : "Create account"}</button>
          <p className="muted">Already have an account? <Link href="/login">Sign in</Link></p>
        </form>
      </div>
    </main>
  );
}

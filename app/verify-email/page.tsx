"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "@/app/components/sign-out-button";

export default function VerifyEmailPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.assign("/login");
        return;
      }
      if (user.email_confirmed_at) {
        window.location.assign("/dashboard");
        return;
      }
      setEmail(user.email ?? null);
    }
    void load();
  }, []);

  function resend() {
    if (!email) return;
    setMessage(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({ type: "signup", email });
      setMessage(error ? "Unable to resend verification email. Please try again shortly." : "A new verification email has been sent.");
    });
  }

  return (
    <main className="page">
      <section className="hero container" style={{ maxWidth: 760 }}>
        <span className="eyebrow">VERIFY YOUR EMAIL</span>
        <h1>One last step before entering Avenlo.</h1>
        <p>We need you to verify your email address before accessing your protected candidate or company workspace.</p>
        <div className="card form">
          <p><strong>{email ?? "Your email address"}</strong></p>
          <div className="actions">
            <button className="btn primary" type="button" onClick={resend} disabled={pending || !email}>
              {pending ? "Sending…" : "Resend verification email"}
            </button>
            <Link className="btn" href="/">Public site</Link>
            <SignOutButton />
          </div>
          {message ? <p className="muted" role="status">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}

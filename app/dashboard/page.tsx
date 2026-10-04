import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, role, status").eq("id", user.id).maybeSingle();
  if (profile?.role === "company") redirect("/company");
  if (profile?.role === "staff" || profile?.role === "founder") redirect("/staff");

  return (
    <main className="page">
      <nav className="nav container"><span className="brand">AVENLO</span><Link className="btn" href="/">Home</Link></nav>
      <section className="hero container" style={{ maxWidth: 900 }}>
        <span className="eyebrow">PRIVATE DASHBOARD</span>
        <h1>{profile?.full_name ? `Welcome, ${profile.full_name}.` : "Welcome to Avenlo."}</h1>
        <div className="grid">
          <article className="card"><span className="eyebrow">PROFILE</span><h2>{profile?.status === "active" ? "Profile active" : "Finish your profile"}</h2><p className="muted">Add your professional background, skills, preferences and CV so the Avenlo team can understand your profile.</p><Link className="btn primary" href="/dashboard/profile">Edit profile</Link></article>
          <article className="card"><span className="eyebrow">OPPORTUNITIES</span><h2>Human-led matching</h2><p className="muted">Relevant opportunities will appear here after your profile contains enough information for a meaningful match.</p></article>
          <article className="card"><span className="eyebrow">ACCOUNT</span><h2>{profile?.role ?? "candidate"}</h2><p className="muted">Your account is protected by Supabase Auth and row-level security.</p></article>
        </div>
      </section>
    </main>
  );
}

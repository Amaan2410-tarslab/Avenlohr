"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page"><div className="container hero"><span className="eyebrow">AVENLO</span><h1>Something went wrong.</h1><p className="muted">We couldn't complete that request. Please try again.</p><button className="btn primary" type="button" onClick={() => reset()}>Try again</button></div></main>;
}

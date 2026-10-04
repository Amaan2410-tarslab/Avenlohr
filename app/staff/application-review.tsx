"use client";

import { useState, useTransition } from "react";
import { calculateApplicationMatch } from "./actions";

export function ApplicationReview({ applicationId, matchScore }: { applicationId: string; matchScore: number | null }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function calculate() {
    setMessage(null);
    startTransition(async () => {
      const result = await calculateApplicationMatch({ applicationId });
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }

  return (
    <div className="actions">
      <button className="btn" type="button" onClick={calculate} disabled={pending}>
        {pending ? "Calculating…" : matchScore == null ? "Calculate match" : "Recalculate match"}
      </button>
      {matchScore != null ? <span className="muted">{matchScore}%</span> : null}
      {message ? <span className="muted" role="status">{message}</span> : null}
    </div>
  );
}

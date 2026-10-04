"use client";

import { useState, useTransition } from "react";
import { submitReport } from "./report-actions";

type TargetType = "job" | "candidate" | "company" | "application";

export function ReportButton({ targetType, targetId }: { targetType: TargetType; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await submitReport({ targetType, targetId, reason });
      setMessage(result.message);
      if (result.ok) {
        setReason("");
        setOpen(false);
      }
    });
  }

  if (!open) {
    return <button className="btn" type="button" onClick={() => setOpen(true)}>Report</button>;
  }

  return (
    <div className="form" style={{ minWidth: 260 }}>
      <label>Report reason
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Describe the issue"
          maxLength={2000}
          disabled={pending}
        />
      </label>
      <div className="actions" style={{ marginTop: 0 }}>
        <button className="btn primary" type="button" onClick={submit} disabled={pending || reason.trim().length < 10}>
          {pending ? "Submitting…" : "Submit report"}
        </button>
        <button className="btn" type="button" onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
      </div>
      {message ? <span className="muted" role="status">{message}</span> : null}
    </div>
  );
}

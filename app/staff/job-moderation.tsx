"use client";

import { useState, useTransition } from "react";
import { moderateJob } from "./actions";

export function JobModeration({ jobId, status }: { jobId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function update(nextStatus: "open" | "closed") {
    setMessage(null);
    startTransition(async () => {
      const result = await moderateJob({ jobId, status: nextStatus });
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }

  if (status === "pending_review") {
    return <div className="actions"><button className="btn primary" type="button" disabled={pending} onClick={() => update("open")}>{pending ? "Approving…" : "Approve"}</button><button className="btn" type="button" disabled={pending} onClick={() => update("closed")}>Reject</button>{message ? <span className="muted">{message}</span> : null}</div>;
  }

  if (status === "open") return <button className="btn" type="button" disabled={pending} onClick={() => update("closed")}>{pending ? "Closing…" : "Close role"}</button>;
  return <span className="muted">{message || status}</span>;
}

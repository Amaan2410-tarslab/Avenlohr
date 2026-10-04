"use client";

import { useState, useTransition } from "react";
import { updateReportStatus } from "./actions";

type Status = "open" | "reviewing" | "resolved" | "dismissed";

export function ReportStatusControl({ reportId, status }: { reportId: string; status: Status }) {
  const [value, setValue] = useState<Status>(status);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateReportStatus({ reportId, status: value });
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }

  return (
    <div className="actions">
      <label>Report status
        <select value={value} onChange={(event) => setValue(event.target.value as Status)} disabled={pending}>
          <option value="open">Open</option>
          <option value="reviewing">Reviewing</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </label>
      <button className="btn" type="button" onClick={save} disabled={pending || value === status}>
        {pending ? "Saving…" : "Save"}
      </button>
      {message ? <span className="muted" role="status">{message}</span> : null}
    </div>
  );
}

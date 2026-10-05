"use client";

import { useState, useTransition } from "react";
import { setProfileStatus } from "./actions";

type Status = "draft" | "active" | "suspended" | "archived";

export function ProfileStatusControl({ userId, status }: { userId: string; status: Status }) {
  const [value, setValue] = useState<Status>(status);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await setProfileStatus({ userId, status: value });
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }

  return (
    <div className="actions">
      <label>Account status
        <select value={value} onChange={(event) => setValue(event.target.value as Status)} disabled={pending}>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <button className="btn" type="button" onClick={save} disabled={pending || value === status}>
        {pending ? "Saving…" : "Save"}
      </button>
      {message ? <span className="muted" role="status">{message}</span> : null}
    </div>
  );
}

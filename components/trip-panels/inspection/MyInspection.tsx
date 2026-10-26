"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { InspectionKind } from "@/lib/inspections";
import { type ExistingInspection, InspectionForm } from "./InspectionForm";

/** The viewer's own check-in or check-out: the form until it's sent, then what they sent with a way to fix it. */
export function MyInspection({
  tripId,
  kind,
  electric,
  existing,
  children,
}: {
  tripId: string;
  kind: InspectionKind;
  electric: boolean;
  existing: ExistingInspection | null;
  /** What was sent, shown while not editing. */
  children?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  if (!existing) return <InspectionForm tripId={tripId} kind={kind} electric={electric} existing={null} />;
  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <InspectionForm tripId={tripId} kind={kind} electric={electric} existing={existing} onDone={() => setEditing(false)} />
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Never mind
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {children}
      <Button variant="outline" size="sm" className="self-start" onClick={() => setEditing(true)}>
        Edit
      </Button>
    </div>
  );
}

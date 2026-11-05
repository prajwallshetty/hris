"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EntityCombobox } from "@/components/shared/entity-combobox";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { COORDINATOR_SOURCE_LABELS, type CoordinatorSource } from "@/lib/coordinator-resolution";
import { suggestCoordinator } from "@/server/actions/coordinator-suggestion";

type Suggestion = { coordinatorId: string | null; coordinatorName: string | null; source: CoordinatorSource };

/**
 * Coordinator picker that follows the placement (§ coordinator assignment).
 * When the client or project changes it asks the server for that project's
 * coordinator (falling back to the client's) and fills the field in.
 *
 * It only ever overwrites a value it filled in itself (or an empty one): a
 * coordinator the user picked by hand is kept when the project changes, and
 * the new suggestion is offered as a one-click "Use …" instead.
 */
export function CoordinatorField({
  clientId,
  projectId,
  value,
  onChange,
  error,
  id = "coordinatorId",
  label = "Coordinator",
}: {
  clientId: string;
  projectId: string;
  value: string;
  onChange: (coordinatorId: string) => void;
  error?: string;
  id?: string;
  label?: string;
}) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const suggestionRef = useRef<Suggestion | null>(null);
  const valueRef = useRef(value);
  const requestRef = useRef(0);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    // No client → nothing to suggest from. Drop only an auto-filled value.
    const previous = suggestionRef.current;
    const wasAuto = !valueRef.current || valueRef.current === previous?.coordinatorId;
    const request = ++requestRef.current;

    if (!clientId) {
      suggestionRef.current = null;
      queueMicrotask(() => {
        if (request !== requestRef.current) return;
        setSuggestion(null);
        setLoading(false);
        if (wasAuto) onChangeRef.current("");
      });
      return;
    }

    queueMicrotask(() => request === requestRef.current && setLoading(true));
    suggestCoordinator({ clientId, projectId: projectId || undefined }).then((result) => {
      if (request !== requestRef.current) return; // a newer client/project choice superseded this one
      setLoading(false);
      const next = result.success ? result.data : null;
      suggestionRef.current = next;
      setSuggestion(next);
      // Re-read the value now: the user may have picked one while we waited.
      const current = valueRef.current;
      const stillAuto = !current || current === previous?.coordinatorId;
      if (wasAuto && stillAuto) onChangeRef.current(next?.coordinatorId ?? "");
    });
  }, [clientId, projectId]);

  const isAuto = Boolean(value) && value === suggestion?.coordinatorId;
  const offered = suggestion?.coordinatorId && value && value !== suggestion.coordinatorId ? suggestion : null;

  let note: React.ReactNode;
  if (loading) {
    note = (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="size-3 animate-spin" /> Looking up the coordinator…
      </span>
    );
  } else if (isAuto && suggestion) {
    note = (
      <span className="inline-flex items-center gap-1.5 text-teal-700">
        <Sparkles className="size-3" /> {COORDINATOR_SOURCE_LABELS[suggestion.source]} — you can change it.
      </span>
    );
  } else if (value) {
    note = "Chosen manually — kept when you change the project.";
  } else if (clientId && suggestion?.source === "none") {
    note = "No coordinator is set on this project or client — choose one if needed, or leave unassigned.";
  } else {
    note = "Filled in automatically from the project once you choose a client and project.";
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <EntityCombobox
        id={id}
        entityType="coordinator"
        value={value}
        onChange={(next) => onChange(next)}
        placeholder="Select Coordinator (Optional)"
        error={error}
      />
      <FieldDescription>{note}</FieldDescription>
      {offered && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            {COORDINATOR_SOURCE_LABELS[offered.source]} is <strong>{offered.coordinatorName}</strong>.
          </span>
          <Button type="button" size="xs" variant="outline" onClick={() => onChange(offered.coordinatorId ?? "")}>
            Use {offered.coordinatorName}
          </Button>
        </div>
      )}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

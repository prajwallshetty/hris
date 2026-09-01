"use client";

import { FileText, Upload, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Shared drag-and-drop file input (§17/§38) — replaces bare `<input type="file">`. */
export function FileUploader({
  value,
  onChange,
  accept,
  maxSizeMb = 10,
  hint,
  disabled,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  maxSizeMb?: number;
  hint?: string;
  disabled?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  function acceptFile(file: File | undefined) {
    if (!file) return;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File is larger than ${maxSizeMb} MB.`);
      return;
    }
    setError(null);
    onChange(file);
  }

  if (value) {
    return (
      <div className="border-border bg-muted/30 flex items-center gap-3 rounded-lg border p-3">
        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
          <FileText className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{value.name}</p>
          <p className="text-muted-foreground text-xs">{formatBytes(value.size)}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          onClick={() => {
            onChange(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          aria-label="Remove file"
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!disabled) acceptFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-primary/40 hover:bg-muted/30",
          isDragging && "border-primary bg-primary/5",
        )}
      >
        <div className="bg-muted flex size-10 items-center justify-center rounded-full">
          <Upload className="text-muted-foreground size-4.5" />
        </div>
        <p className="text-sm font-medium">
          <span className="text-primary">Click to upload</span> or drag and drop
        </p>
        <p className="text-muted-foreground text-xs">{hint ?? `Up to ${maxSizeMb} MB`}</p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => acceptFile(e.target.files?.[0])}
        />
      </label>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

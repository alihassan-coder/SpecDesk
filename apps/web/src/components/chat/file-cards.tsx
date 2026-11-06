"use client";

import { FileArchive, FileCode2, FileSpreadsheet, FileText, FileType2, Workflow } from "lucide-react";
import type { PlanFile } from "@/mocks/types";
import { cn } from "@/lib/utils";

export const fileIcon: Record<PlanFile["kind"], typeof FileText> = {
  pdf: FileType2,
  md: FileText,
  csv: FileSpreadsheet,
  json: FileCode2,
  mmd: Workflow,
  zip: FileArchive,
};

export function FileCards({
  files,
  activeId,
  onOpen,
}: {
  files: PlanFile[];
  activeId?: string | null;
  onOpen: (file: PlanFile) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">
        {files.length} {files.length === 1 ? "file" : "files"} ready
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {files.map((f) => {
          const Icon = fileIcon[f.kind];
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onOpen(f)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors",
                  "hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-ring",
                  activeId === f.id && "border-primary bg-primary/10",
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary">
                  <Icon className="size-4.5 text-primary" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-mono text-sm">{f.name}</span>
                  <span className="text-xs text-muted-foreground uppercase">
                    {f.kind} · {f.size}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

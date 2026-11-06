"use client";

import { Copy, Download, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DEMO_PLAN } from "@/mocks/data";
import type { PlanFile } from "@/mocks/types";
import { formatRange } from "@/lib/format";
import { estimate } from "@/lib/pricing";
import { fileIcon } from "./file-cards";

/** Side panel that previews a generated file — like ChatGPT/Claude artifacts. */
export function ArtifactPanel({ file, onClose }: { file: PlanFile; onClose: () => void }) {
  const Icon = fileIcon[file.kind];

  const download = () => toast.success(`Downloading ${file.name}`, { description: "Real files arrive in M5." });
  const copy = async () => {
    if (!file.preview) return;
    try {
      await navigator.clipboard.writeText(file.preview);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy", { description: "Your browser blocked clipboard access. Select the text and copy it instead." });
    }
  };

  return (
    <aside aria-label={`Preview of ${file.name}`} className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground uppercase">
              {file.kind} · {file.size}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {file.preview && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={copy} aria-label="Copy contents">
                  <Copy className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={download} aria-label={`Download ${file.name}`}>
                <Download className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close preview">
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          {file.kind === "pdf" && <PdfPreview />}
          {file.kind === "zip" && <ZipPreview />}
          {file.kind === "csv" && file.preview && <CsvPreview text={file.preview} />}
          {(file.kind === "md" || file.kind === "mmd" || file.kind === "json") && file.preview && (
            <pre className="overflow-x-auto rounded-lg border bg-background p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
              {file.preview}
            </pre>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

function PdfPreview() {
  const plan = DEMO_PLAN;
  const est = estimate(plan.features, plan);
  return (
    <div className="mx-auto aspect-[1/1.414] max-w-md rounded-sm bg-white p-8 text-[#0c1220] shadow-xl">
      <div className="flex items-center justify-between border-b border-[#0c1220]/15 pb-3 text-[10px] text-[#56627a]">
        <span>SpecDesk · Project plan</span>
        <span>v2 · Nov 2026</span>
      </div>
      <h2 className="mt-6 text-2xl font-semibold">{plan.title}</h2>
      <p className="mt-1 text-xs text-[#56627a]">{plan.oneLiner}</p>
      <div className="mt-6 grid grid-cols-3 gap-2 text-center">
        {[
          ["Price", formatRange(est.priceMin, est.priceMax)],
          ["Timeline", `${est.weeks} weeks`],
          ["Readiness", `${plan.readiness}/100`],
        ].map(([k, v]) => (
          <div key={k} className="rounded border border-[#0c1220]/10 p-2">
            <p className="text-[9px] text-[#56627a]">{k}</p>
            <p className="text-[11px] font-semibold">{v}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-[10px] font-semibold">MVP features</p>
      <ul className="mt-1 space-y-1 text-[10px]">
        {plan.features
          .filter((f) => f.included)
          .map((f) => (
            <li key={f.id} className="flex justify-between border-b border-[#0c1220]/5 pb-1">
              <span>{f.name}</span>
              <span className="text-[#56627a]">{f.complexity}</span>
            </li>
          ))}
      </ul>
      <div className="mt-6 h-1.5 w-1/3 rounded-full bg-[var(--accent-user)]" />
    </div>
  );
}

function ZipPreview() {
  return (
    <ul className="divide-y rounded-lg border font-mono text-sm">
      {DEMO_PLAN.files
        .filter((f) => f.kind !== "zip")
        .map((f) => (
          <li key={f.id} className="flex justify-between px-3 py-2">
            <span>{f.name}</span>
            <span className="text-muted-foreground">{f.size}</span>
          </li>
        ))}
    </ul>
  );
}

function CsvPreview({ text }: { text: string }) {
  const [head, ...rows] = text.trim().split("\n").map((r) => r.split(","));
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-left">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-t">
              {r.map((c, i) => (
                <td key={i} className="px-3 py-2 whitespace-nowrap">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

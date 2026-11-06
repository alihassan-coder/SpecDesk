import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Renders assistant Markdown (GFM: lists, tables, task lists, code) with theme tokens. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("space-y-3 text-[15px] leading-relaxed text-pretty", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h3 className="text-lg font-semibold tracking-tight" {...p} />,
          h2: (p) => <h3 className="text-base font-semibold tracking-tight" {...p} />,
          h3: (p) => <h4 className="font-semibold" {...p} />,
          p: (p) => <p {...p} />,
          ul: (p) => <ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground" {...p} />,
          ol: (p) => <ol className="list-decimal space-y-1 pl-5 marker:text-muted-foreground" {...p} />,
          li: (p) => <li className="pl-0.5" {...p} />,
          strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
          a: (p) => <a className="font-medium text-primary underline underline-offset-4" target="_blank" rel="noreferrer" {...p} />,
          blockquote: (p) => <blockquote className="border-l-2 pl-3 text-muted-foreground" {...p} />,
          hr: () => <hr className="border-border" />,
          code: ({ className: c, children, ...p }) =>
            /language-/.test(c ?? "") ? (
              <code className={cn("font-mono text-[13px]", c)} {...p}>
                {children}
              </code>
            ) : (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px]" {...p}>
                {children}
              </code>
            ),
          pre: (p) => <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 text-[13px]" {...p} />,
          table: (p) => (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm" {...p} />
            </div>
          ),
          thead: (p) => <thead className="bg-muted/50 text-left" {...p} />,
          th: (p) => <th className="px-3 py-2 font-medium" {...p} />,
          td: (p) => <td className="border-t px-3 py-2" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

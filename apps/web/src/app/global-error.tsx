"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last resort: the root layout itself failed, so this replaces the whole document (it must render
 * its own <html> and <body>). Plain markup only — providers and fonts may be what broke.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-svh items-center justify-center bg-background p-4 font-sans text-foreground antialiased">
        <main className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">SpecDesk couldn&apos;t load</h1>
          <p className="mt-2 text-muted-foreground">
            Something went wrong on our side. Your plans are safe. Try again, and if it keeps happening, come back in a few minutes.
          </p>
          {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

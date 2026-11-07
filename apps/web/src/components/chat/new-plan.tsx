"use client";

import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { IdeaBox } from "@/components/landing/idea-box";
import { useDemoSession } from "@/components/providers/demo-session";

export function NewPlan() {
  const { role } = useDemoSession();
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <LogoMark className="size-10 rounded-xl [&_svg]:size-6" />
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">What are you building?</h1>
        </div>
        <IdeaBox next={role === "guest" ? "login" : "chat"} />
        {role === "guest" && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/chat/demo" className="text-foreground underline underline-offset-4">
              See the demo
            </Link>{" "}
            or log in to save plans.
          </p>
        )}
      </div>
    </div>
  );
}

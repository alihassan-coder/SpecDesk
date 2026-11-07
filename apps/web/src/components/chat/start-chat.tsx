"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useDemoSession } from "@/components/providers/demo-session";
import { ApiError, api, type Depth } from "@/lib/api";
import { humanize, type HumanError } from "@/lib/errors";
import { ChatView, UserBubble } from "./chat-view";
import { ErrorCard } from "./status-cards";

const DEPTHS: Depth[] = ["quick", "balanced", "thorough"];

/**
 * `/chat/new?idea=…`: signed-in founders get a real chat (created, then opened at /chat/<id>);
 * guests see the demo conversation for their idea.
 */
export function StartChat({ idea, depth, platform, budget }: { idea: string; depth?: string; platform?: string; budget?: string }) {
  const { role, isPending } = useDemoSession();
  const router = useRouter();
  const [error, setError] = useState<HumanError | null>(null);
  const started = useRef(false);

  const create = async () => {
    setError(null);
    try {
      const chat = await api.createChat({
        idea,
        depth: DEPTHS.includes(depth as Depth) ? (depth as Depth) : "balanced",
        platform: platform || undefined,
        budget: budget || undefined,
      });
      router.replace(`/chat/${chat.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.error : humanize("server_error"));
    }
  };

  useEffect(() => {
    if (isPending || role === "guest" || started.current) return;
    started.current = true;
    void create();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when the session is known
  }, [isPending, role]);

  if (!isPending && role === "guest") return <ChatView key={idea} idea={idea} title="New plan" />;

  return (
    <div className="mx-auto w-full max-w-[var(--chat-width)] space-y-6 px-4 pt-6 sm:px-6">
      <UserBubble text={idea} />
      {error ? (
        <ErrorCard error={error} onRetry={() => void create()} />
      ) : (
        <div className="flex items-center gap-3 pl-9 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Starting your plan…
        </div>
      )}
    </div>
  );
}

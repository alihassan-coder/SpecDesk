import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatView } from "@/components/chat/chat-view";
import { LiveChat } from "@/components/chat/live-chat";
import { StartChat } from "@/components/chat/start-chat";
import { isUuid } from "@/lib/api";
import { CHATS, DEMO_IDEA } from "@/mocks/data";

export async function generateMetadata({ params }: PageProps<"/chat/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: isUuid(id) ? "Plan" : (CHATS.find((c) => c.id === id)?.title ?? "Plan") };
}

/**
 * Real chats use their UUID: /chat/<uuid> (signed in; src/proxy.ts redirects to login otherwise).
 *
 * Mock routes for review:
 *   /chat/demo        interactive guest demo
 *   /chat/new?idea=…  signed in: creates a real chat; guest: demo for that idea
 *   /chat/c2, c4      finished chats
 *   /chat/c3          still interviewing
 *   /chat/error       humanized error state
 */
export default async function ChatPage({ params, searchParams }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  if (isUuid(id)) return <LiveChat key={id} chatId={id} />;
  const sp = await searchParams;

  if (id === "new") {
    const param = (k: string) => (typeof sp[k] === "string" ? sp[k] : undefined);
    const idea = param("idea")?.trim() || DEMO_IDEA;
    return <StartChat key={idea} idea={idea} depth={param("depth")} platform={param("platform")} budget={param("budget")} />;
  }
  if (id === "error") return <ChatView idea={DEMO_IDEA} title="Plan" forceError="model_unavailable" />;

  const chat = CHATS.find((c) => c.id === id);
  if (!chat) notFound();

  return <ChatView key={id} idea={DEMO_IDEA} title={chat.title} startFinished={chat.status === "ready" && id !== "demo"} />;
}

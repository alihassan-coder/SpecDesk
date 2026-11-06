import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatView } from "@/components/chat/chat-view";
import { CHATS, DEMO_IDEA } from "@/mocks/data";

export async function generateMetadata({ params }: PageProps<"/chat/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: CHATS.find((c) => c.id === id)?.title ?? "Plan" };
}

/**
 * Mock routes for review:
 *   /chat/demo        interactive guest demo
 *   /chat/new?idea=…  fresh chat from an idea
 *   /chat/c2, c4      finished chats
 *   /chat/c3          still interviewing
 *   /chat/error       humanized error state
 */
export default async function ChatPage({ params, searchParams }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  const sp = await searchParams;

  if (id === "new") {
    const idea = typeof sp.idea === "string" && sp.idea.trim() ? sp.idea : DEMO_IDEA;
    return <ChatView key={idea} idea={idea} title="New plan" />;
  }
  if (id === "error") return <ChatView idea={DEMO_IDEA} title="Plan" forceError="model_unavailable" />;

  const chat = CHATS.find((c) => c.id === id);
  if (!chat) notFound();

  return <ChatView key={id} idea={DEMO_IDEA} title={chat.title} startFinished={chat.status === "ready" && id !== "demo"} />;
}

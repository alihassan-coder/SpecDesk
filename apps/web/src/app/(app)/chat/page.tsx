import type { Metadata } from "next";
import { NewPlan } from "@/components/chat/new-plan";

export const metadata: Metadata = { title: "New plan" };

export default function NewChatPage() {
  return <NewPlan />;
}

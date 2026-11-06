"use client";

import { usePathname } from "next/navigation";
import { CHATS } from "@/mocks/data";

function titleFor(path: string) {
  if (path === "/chat") return "New plan";
  if (path.startsWith("/chat/")) {
    const id = path.split("/")[2];
    return CHATS.find((c) => c.id === id)?.title ?? "Plan";
  }
  if (path.startsWith("/plan/")) return "Plan workspace";
  if (path.startsWith("/settings")) return "Settings";
  if (path.startsWith("/book")) return "Book a call";
  if (path.startsWith("/admin")) return "Admin";
  return "SpecDesk";
}

export function PageTitle() {
  return <h1 className="truncate text-sm font-medium">{titleFor(usePathname())}</h1>;
}

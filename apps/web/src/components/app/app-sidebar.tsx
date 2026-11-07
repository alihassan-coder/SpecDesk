"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarCheck, FileText, LayoutDashboard, Plus, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { LogoMark } from "@/components/brand/logo";
import { useDemoSession } from "@/components/providers/demo-session";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { api, type LiveChatSummary } from "@/lib/api";
import { CHATS } from "@/mocks/data";
import { NavUser } from "./nav-user";

export function AppSidebar() {
  const pathname = usePathname();
  const { role, isPending } = useDemoSession();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [liveChats, setLiveChats] = useState<LiveChatSummary[] | null>(null);
  const signedIn = !isPending && role !== "guest";

  // Signed-in founders see their real chats; refreshed on navigation so a new chat shows up.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    api.listChats().then(
      (rows) => !cancelled && setLiveChats(rows),
      () => !cancelled && setLiveChats((prev) => prev ?? []),
    );
    return () => {
      cancelled = true;
    };
  }, [signedIn, pathname]);

  const chats: { id: string; title: string }[] = signedIn ? (liveChats ?? []) : CHATS.filter((c) => c.id === "demo");
  const latestPlan = liveChats?.find((c) => c.planId)?.planId;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/chat">
                <LogoMark />
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">SpecDesk</span>
                  <span className="truncate text-xs text-muted-foreground">AI project planner</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Planning</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/chat"} tooltip="New plan">
                  <Link href={role === "guest" ? "/login" : "/chat"}>
                    <Plus />
                    <span>New plan</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {!signedIn && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/chat/demo"} tooltip="Demo plan">
                  <Link href="/chat/demo">
                    <Sparkles />
                    <span>Demo plan</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname === "/book"} tooltip="Book a call" onClick={() => setBookingOpen(true)}>
                  <CalendarCheck />
                  <span>Book a call</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {(!signedIn || latestPlan) && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/plan")} tooltip="Plan workspace">
                    <Link href={signedIn && latestPlan ? `/plan/${latestPlan}` : "/plan/demo"}>
                      <LayoutDashboard />
                      <span>Plan workspace</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Recent plans</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {signedIn && liveChats?.length === 0 && (
                <p className="px-2 py-1 text-xs text-muted-foreground">No plans yet. Start one with New plan.</p>
              )}
              {chats.map((c) => (
                <SidebarMenuItem key={c.id}>
                  <SidebarMenuButton asChild isActive={pathname === `/chat/${c.id}`}>
                    <Link href={`/chat/${c.id}`}>
                      <FileText />
                      <span>{c.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {role === "admin" && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith("/admin")} tooltip="Admin">
                <Link href="/admin">
                  <ShieldCheck />
                  <span>Admin</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/settings")} tooltip="Settings">
              <Link href="/settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
      <BookingDialog open={bookingOpen} onOpenChange={setBookingOpen} />

    </Sidebar>
  );
}

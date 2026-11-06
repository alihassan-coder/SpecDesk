"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
import { CHATS } from "@/mocks/data";
import { NavUser } from "./nav-user";

export function AppSidebar() {
  const pathname = usePathname();
  const { role } = useDemoSession();
  const [bookingOpen, setBookingOpen] = useState(false);

  const chats = role === "guest" ? CHATS.filter((c) => c.id === "demo") : CHATS;

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
              {role !== "admin" && (
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
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/plan")} tooltip="Plan workspace">
                  <Link href="/plan/demo">
                    <LayoutDashboard />
                    <span>Plan workspace</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Recent plans</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
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

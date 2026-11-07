import { Suspense } from "react";
import { AppSidebar } from "@/components/app/app-sidebar";
import { PageTitle } from "@/components/app/page-title";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Logo } from "@/components/brand/logo";
import { Separator } from "@/components/ui/separator";
import { Sidebar, SidebarHeader, SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

/** Static fallback so the sidebar frame is part of the prerendered shell. */
function SidebarFallback() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-4 p-3">
        <Logo href="/chat" subtitle="AI project planner" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </SidebarHeader>
    </Sidebar>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider className="app-glass isolate">
      <Suspense fallback={<SidebarFallback />}>
        <AppSidebar />
      </Suspense>
      <SidebarInset className="min-h-svh min-w-0 overflow-x-clip bg-transparent">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/60 px-4 backdrop-blur-xl backdrop-saturate-150">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Suspense fallback={<Skeleton className="h-4 w-32" />}>
            <PageTitle />
          </Suspense>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminOnly } from "@/components/admin/admin-only";
import { AdminView } from "@/components/admin/admin-view";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

/** Server-side gate: signed in, and the session email is in ADMIN_EMAILS (customSession `isAdmin`). */
async function AdminGate() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?next=%2Fadmin");
  if (!session.user.isAdmin) return <AdminOnly />;
  return <AdminView />;
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <AdminGate />
    </Suspense>
  );
}

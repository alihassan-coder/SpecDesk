import type { Metadata } from "next";
import { AdminView } from "@/components/admin/admin-view";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

/** M3: guarded server-side (session email ∈ ADMIN_EMAILS). M1: client role preview. */
export default function AdminPage() {
  return <AdminView />;
}

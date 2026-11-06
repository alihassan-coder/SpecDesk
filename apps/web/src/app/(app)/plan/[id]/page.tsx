import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlanWorkspace } from "@/components/plan/plan-workspace";
import { DEMO_PLAN } from "@/mocks/data";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage({ params }: PageProps<"/plan/[id]">) {
  const { id } = await params;
  if (id !== "demo") notFound();
  return <PlanWorkspace plan={DEMO_PLAN} />;
}

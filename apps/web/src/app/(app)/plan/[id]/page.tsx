import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LivePlanView } from "@/components/plan/live-plan";
import { PlanWorkspace } from "@/components/plan/plan-workspace";
import { isUuid } from "@/lib/api";
import { DEMO_PLAN } from "@/mocks/data";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage({ params }: PageProps<"/plan/[id]">) {
  const { id } = await params;
  if (isUuid(id)) return <LivePlanView key={id} planId={id} />;
  if (id !== "demo") notFound();
  return <PlanWorkspace plan={DEMO_PLAN} />;
}

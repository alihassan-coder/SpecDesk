import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { humanize } from "@/lib/errors";

/** Shown to signed-in people whose email isn't in ADMIN_EMAILS. */
export function AdminOnly() {
  const e = humanize("admin_only");
  return (
    <Empty className="m-6 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldAlert />
        </EmptyMedia>
        <EmptyTitle>{e.title}</EmptyTitle>
        <EmptyDescription>
          {e.message} {e.action}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href="/chat">Back to your plans</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="mx-auto w-full max-w-[var(--chat-width)] space-y-6 px-4 py-8" aria-busy="true" aria-label="Loading plan">
      <Skeleton className="ml-auto h-16 w-3/4" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

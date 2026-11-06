import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * false while a component hydrates (matching the server HTML), true afterwards.
 * Use it where a client-only value (screen size, stored role) arrives via context
 * into a Suspense boundary that hydrates later.
 */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

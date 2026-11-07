import { createAuthClient } from "better-auth/react";
import { customSessionClient, emailOTPClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

/** Browser client. Same origin, so no baseURL is needed. */
export const authClient = createAuthClient({
  plugins: [emailOTPClient(), customSessionClient<typeof auth>()],
});

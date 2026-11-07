import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { customSession, emailOTP, jwt } from "better-auth/plugins";
import { Pool } from "pg";
import { isAdminEmail } from "@/lib/admin";
import { sendOtpEmail } from "@/lib/otp-email";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

/**
 * Better Auth (server). Email + 6-digit code sign-in; the JWT plugin mints short-lived tokens
 * that FastAPI verifies against /api/auth/jwks (iss = aud = BETTER_AUTH_URL, sub = user id).
 * Tables (user, session, account, verification, jwks) are created by Better Auth's CLI, not Alembic.
 */
export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  // Signed session data in a short-lived cookie: most requests skip the database round trip.
  // Sign-out and expiry still work; a revoked session lives at most `maxAge` seconds longer.
  session: {
    expiresIn: 60 * 60 * 24 * 7, // stay logged in for 7 days…
    updateAge: 60 * 60 * 24, // …counted from the last visit: the expiry moves forward once a day
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      async sendVerificationOTP({ email, otp }) {
        await sendOtpEmail(email, otp);
      },
    }),
    jwt({
      jwt: {
        issuer: baseURL,
        audience: baseURL,
        expirationTime: "15m",
        definePayload: ({ user }) => ({ email: user.email, name: user.name }),
      },
    }),
    // Role is derived on the server from ADMIN_EMAILS on every session read.
    customSession(async ({ user, session }) => ({
      user: { ...user, isAdmin: isAdminEmail(user.email) },
      session,
    })),
    nextCookies(), // must stay last
  ],
});

export type AuthSession = typeof auth.$Infer.Session;

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { humanize, type HumanError } from "@/lib/errors";

/** Only same-site relative paths, so `?next=` can't send people to another site. */
function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

/** Better Auth error → humanized error. Codes come from the emailOTP plugin and core. */
function authError(error: { code?: string; status?: number }, fallback: string): HumanError {
  if (error.status === 429) return humanize("too_many_codes");
  switch (error.code) {
    case "INVALID_EMAIL":
      return humanize("invalid_email");
    case "INVALID_OTP":
      return humanize("invalid_otp");
    case "OTP_EXPIRED":
      return humanize("otp_expired");
    case "TOO_MANY_ATTEMPTS":
      return humanize("too_many_attempts");
    default:
      return humanize(fallback);
  }
}

function ErrorText({ error, className }: { error: HumanError; className?: string }) {
  return (
    <FieldError className={className}>
      <span className="font-medium">{error.title}.</span> {error.message} {error.action}
    </FieldError>
  );
}

/** Email → 6-digit code, via Better Auth's emailOTP plugin. */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const idea = params.get("idea");
  const next = safeNext(params.get("next"));

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<HumanError | null>(null);
  const [resent, setResent] = useState(false);

  const sendCode = async () => {
    setError(null);
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError(humanize("invalid_email"));
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email: address, type: "sign-in" });
      if (err) {
        setError(authError(err, "code_not_sent"));
        return;
      }
      setResent(step === "code");
      setCode("");
      setStep("code");
    } catch {
      setError(humanize("network"));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    setError(null);
    setResent(false);
    setBusy(true);
    try {
      const { error: err } = await authClient.signIn.emailOtp({ email: email.trim(), otp: value });
      if (err) {
        setError(authError(err, "invalid_otp"));
        setCode("");
        return;
      }
      router.replace(next ?? (idea ? `/chat/new?idea=${encodeURIComponent(idea)}` : "/chat"));
      router.refresh();
    } catch {
      setError(humanize("network"));
    } finally {
      setBusy(false);
    }
  };

  if (step === "code") {
    return (
      <Card className="glass w-full max-w-sm">
        <CardHeader>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1 w-fit text-muted-foreground"
            onClick={() => {
              setError(null);
              setStep("email");
            }}
          >
            <ArrowLeft /> Change email
          </Button>
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            Sent to <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="otp" className="sr-only">
                6-digit code
              </FieldLabel>
              <InputOTP
                id="otp"
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS}
                value={code}
                onChange={setCode}
                onComplete={(v: string) => void verify(v)}
                disabled={busy}
                autoFocus
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              {error ? (
                <ErrorText error={error} className="text-center" />
              ) : (
                <FieldDescription className="text-center" aria-live="polite">
                  {busy ? "Checking…" : resent ? "New code sent. It expires in 5 minutes." : "Enter the 6-digit code. It expires in 5 minutes."}
                </FieldDescription>
              )}
            </Field>
            <Button variant="outline" onClick={() => void sendCode()} disabled={busy}>
              {busy && <Spinner />} Send a new code
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Sign in to SpecDesk</CardTitle>
        <CardDescription>
          {idea ? "Your idea is saved." : "We'll email you a 6-digit code."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode();
          }}
        >
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
              />
              {error && <ErrorText error={error} />}
            </Field>
            <Field>
              <Button type="submit" disabled={busy}>
                {busy ? <Spinner /> : <Mail />}
                Email me a code
              </Button>
              <Button asChild variant="ghost">
                <Link href="/chat/demo">See the demo</Link>
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

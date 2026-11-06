"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useDemoSession } from "@/components/providers/demo-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";

/**
 * M1: simulated. M3 wires this to Better Auth's emailOTP plugin:
 *   authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })
 *   authClient.signIn.emailOtp({ email, otp })
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const idea = params.get("idea");
  const { setRole } = useDemoSession();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("That doesn't look like an email address. Check for typos.");
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    setStep("code");
  };

  const verify = async (value: string) => {
    setError(null);
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    if (value === "000000") {
      setError("That code isn't right. Check the latest email from SpecDesk, or send a new code.");
      setCode("");
      return;
    }
    setRole(email.trim().toLowerCase() === "alihassan.coder@gmail.com" ? "admin" : "founder");
    router.push(idea ? `/chat/new?idea=${encodeURIComponent(idea)}` : "/chat");
  };

  if (step === "code") {
    return (
      <Card className="glass w-full max-w-sm">
        <CardHeader>
          <Button variant="ghost" size="sm" className="-ml-2 mb-1 w-fit text-muted-foreground" onClick={() => setStep("email")}>
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
                <FieldError className="text-center">{error}</FieldError>
              ) : (
                <FieldDescription className="text-center">
                  {busy ? "Checking…" : "Demo: any code except 000000"}
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
              {error && <FieldError>{error}</FieldError>}
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

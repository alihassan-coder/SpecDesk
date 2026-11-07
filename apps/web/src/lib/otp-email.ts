/**
 * Sends the sign-in code through Brevo's transactional email API (https://developers.brevo.com).
 * Without BREVO_API_KEY (local dev) the code is printed in the Next.js terminal instead.
 */
export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("BREVO_API_KEY is not set, so sign-in codes can't be emailed.");
    }
    console.log(`\n[SpecDesk dev] Sign-in code for ${email}: ${otp}\n`);
    return;
  }

  const senderEmail = process.env.EMAIL_FROM_ADDRESS;
  if (!senderEmail) {
    throw new Error("EMAIL_FROM_ADDRESS is not set. Use a sender address verified in Brevo.");
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: process.env.EMAIL_FROM_NAME || "SpecDesk", email: senderEmail },
      to: [{ email }],
      subject: `${otp} is your SpecDesk code`,
      textContent: `Your SpecDesk sign-in code is ${otp}. It expires in 5 minutes. If you didn't ask for it, ignore this email.`,
      htmlContent: `<p>Your SpecDesk sign-in code is</p><p style="font-size:24px;font-weight:600;letter-spacing:4px">${otp}</p><p>It expires in 5 minutes. If you didn't ask for it, ignore this email.</p>`,
    }),
  });
  if (!res.ok) {
    // Log Brevo's error code (e.g. "unauthorized", sender not valid) — never the request.
    let reason = "";
    try {
      const body = (await res.json()) as { code?: string; message?: string };
      reason = [body.code, body.message].filter(Boolean).join(": ");
    } catch {
      // no JSON body
    }
    console.error(`[SpecDesk] Brevo rejected the sign-in email (HTTP ${res.status}) ${reason}`);
    throw new Error(`Brevo rejected the sign-in email (HTTP ${res.status}).`);
  }
}

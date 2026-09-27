type ValidationResult = { status: "valid" | "invalid" | "unavailable" };

async function safeJson(response: Response) {
  return response.json().catch(() => ({} as Record<string, unknown>));
}

export async function validateContact(email: string, phoneE164: string): Promise<ValidationResult> {
  // Bloqueia placeholders óbvios mesmo quando a API está indisponível.
  const normalizedEmail = email.trim().toLowerCase();
  const emailDomain = normalizedEmail.split("@")[1] ?? "";
  const repeatedPhone = /^(\d)\1+$/.test(phoneE164.replace(/\D/g, "").slice(-8));
  const placeholderEmail = !normalizedEmail.includes("@") || ["dominio.com", "example.com", "teste.com", "test.com"].includes(emailDomain) || normalizedEmail.includes("@dominio.");
  const emailKey = process.env["TRUEGUARD_API_KEY"]?.trim();
  const phoneKey = process.env["PHONEVALIDATION_API_KEY"]?.trim();
  if (!emailKey || !phoneKey) return { status: "unavailable" };

  try {
    const [emailResponse, phoneResponse] = await Promise.all([
      fetch("https://api.trueguard.io/v2/email/validation", {
        method: "POST",
        headers: { "X-API-KEY": emailKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(5000),
      }),
      fetch("https://phonevalidationapi.com/api/v1/validate", {
        method: "POST",
        headers: { Authorization: `Bearer ${phoneKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneE164 }),
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    // Quota, provider or network errors are fail-open by design: the portal
    // must keep operating and the lead is still recorded.
    if (!emailResponse.ok || !phoneResponse.ok) return { status: "unavailable" };
    const [emailResult, phoneResult] = await Promise.all([
      safeJson(emailResponse),
      safeJson(phoneResponse),
    ]);

    const emailSafe =
      (emailResult as any)?.syntax?.isValid === true &&
      (emailResult as any)?.deliverability?.isDeliverable === true &&
      (emailResult as any)?.quality?.isDisposable !== true;
    const phoneSafe =
      (phoneResult as any)?.valid === true &&
      (phoneResult as any)?.is_disposable !== true &&
      (phoneResult as any)?.confidence !== "low";
    const localInvalid = placeholderEmail || repeatedPhone;
    return !localInvalid && emailSafe && phoneSafe ? { status: "valid" } : { status: "invalid" };
  } catch (error) {
    console.warn("[contact-validation] Provider unavailable; allowing check-in", error);
    return { status: "unavailable" };
  }
}

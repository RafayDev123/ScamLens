/** Transactional email through Resend's HTTP API. Returns false when not configured – never pretends to send. */
export function emailConfigured(): boolean {
  return Boolean(process.env.EMAIL_PROVIDER_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.EMAIL_PROVIDER_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

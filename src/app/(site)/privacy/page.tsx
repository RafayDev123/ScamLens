import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy and Data Retention",
  description: "What ScamLens stores, how long it keeps it, what is redacted, and how to delete your data.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <p className="mono text-xs uppercase tracking-wider text-accent">Privacy &amp; retention</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Your data, in plain language</h1>
      <p className="mt-3 text-sm text-muted">Updated 2026-11-17</p>
      <div className="prose-sl mt-6">
        <h2>What we store</h2>
        <table><thead><tr><th>Data</th><th>Guests</th><th>Signed-in users</th></tr></thead><tbody>
          <tr><td>Reports (redacted subject, findings, evidence)</td><td>Deleted after 24 hours</td><td>Kept for your retention period (default 90 days, 1–365) when history is on; otherwise 24 hours</td></tr>
          <tr><td>URL query values, tokens, credentials</td><td colSpan={2}>Redacted before storage and logging</td></tr>
          <tr><td>Message text</td><td colSpan={2}>Digits, e-mails and link secrets redacted; truncated copy only</td></tr>
          <tr><td>QR images</td><td colSpan={2}>Never uploaded or stored. Decoded in your browser</td></tr>
          <tr><td>IP address</td><td colSpan={2}>Only a short irreversible fingerprint for rate limiting and audit logs</td></tr>
        </tbody></table>
        <h2>What leaves ScamLens</h2>
        <p>Only with your explicit tick-box consent, a URL (without credentials or fragment) or domain is sent to reputation providers the operator has configured. Each report lists exactly which sources were consulted. Message text is never sent to third parties.</p>
        <h2>Please don&apos;t submit private links</h2>
        <p>Password-reset links, signed document links and logged-in session URLs can contain access tokens. Do not submit them.</p>
        <h2>Your controls</h2>
        <ul><li>Delete individual reports, all history or your entire account in Settings.</li><li>Export all your records as JSON.</li><li>Create and revoke private report share links (they expire after 7 days).</li></ul>
        <h2>We never</h2>
        <ul><li>sell submitted content,</li><li>ask for passwords, OTPs or mailbox access.</li></ul>
      </div>
    </div>
  );
}

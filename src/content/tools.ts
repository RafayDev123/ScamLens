export interface ToolPage {
  slug: string;
  appPath: string;
  name: string;
  /** SEO title */
  title: string;
  h1: string;
  description: string;
  answer: string;
  steps: string[];
  checks: string[];
  faq: { q: string; a: string }[];
  related: string;
  module: string;
}

export const TOOLS: ToolPage[] = [
  {
    slug: "url-scanner", appPath: "/app/url-scanner", module: "01", name: "URL Scanner",
    title: "Phishing Link Checker – Check a Suspicious URL",
    h1: "Check a suspicious URL before you click",
    description: "Free phishing link checker: analyze a URL's structure, lookalike domains, redirects and threat-intelligence listings, with every finding explained.",
    answer: "ScamLens analyzes a link without opening it in your browser. It parses and normalizes the URL, looks for look-alike domains, misleading subdomains, IP hosts and unusual ports, queries configured threat-intelligence providers and can trace redirects with a restricted header-only fetcher.",
    steps: ["Paste the link exactly as you received it.", "Choose whether reputation providers and redirect expansion may be used.", "Read the explained findings, evidence and recommended next steps.", "Export, copy or print the report."],
    checks: ["Syntax, punycode and mixed-alphabet inspection", "Lookalike and typosquatting comparison with reference brands", "Shortener recognition and redirect chain", "Known phishing / malware listings from configured providers", "Canonical URL for comparison"],
    faq: [
      { q: "How do I check if a link is suspicious?", a: "Paste it into the URL scanner. It inspects the address and explains each warning sign without visiting the page in your browser." },
      { q: "Can HTTPS websites be fraudulent?", a: "Yes. HTTPS only encrypts the connection. ScamLens never treats HTTPS as proof of trust." },
      { q: "Does ‘No Known Threat Detected’ mean the link is safe?", a: "No. It means the checks that ran found nothing. New threats may not be listed yet." },
    ],
    related: "how-to-check-if-a-link-is-suspicious",
  },
  {
    slug: "message-analyzer", appPath: "/app/message-analyzer", module: "02", name: "Message Analyzer",
    title: "Scam Message Checker – WhatsApp, SMS and Email Analyzer",
    h1: "Analyze a suspicious message",
    description: "Check WhatsApp, SMS and email text for scam patterns in English, Urdu and Roman Urdu. Private by default – nothing is sent to third-party AI services.",
    answer: "Paste a message and ScamLens highlights the specific wording that matches known scam patterns – OTP requests, account threats, fake courier notices, prize claims, advance fees, job scams and more – and explains why each could be suspicious. Processing is local to ScamLens; the text is not sent to third parties.",
    steps: ["Paste the message text.", "Review highlighted indicators and why they matter.", "Analyze any embedded links separately.", "Follow the suggested verification actions."],
    checks: ["Requests for OTPs, PINs and passwords", "Account suspension and legal threats", "Courier, bank and impersonation patterns", "Prize, job and advance-fee lures", "Shortened and suspicious links"],
    faq: [
      { q: "What is a phishing message?", a: "A message designed to trick you into sharing credentials, money or personal data, often by imitating a trusted organization." },
      { q: "Is every urgent message a scam?", a: "No. Urgency alone is a weak signal. It matters when combined with requests for money, codes or links." },
      { q: "Does ScamLens send my message to an AI service?", a: "No. The default analysis runs on ScamLens' own rules, and personal data is redacted before storage." },
    ],
    related: "fake-banking-messages",
  },
  {
    slug: "qr-code-checker", appPath: "/app/qr-checker", module: "03", name: "QR Code Checker",
    title: "QR Code Security Checker – Decode Without Opening",
    h1: "Check where a QR code really leads",
    description: "Decode a QR code in your browser, see its content type and destination, and analyze the URL – without ever opening it automatically.",
    answer: "ScamLens decodes QR images locally in your browser using ZXing, shows the decoded content and its type (URL, Wi-Fi, phone, SMS, email, payment and more) and lets you continue to a URL analysis. The image is not uploaded and the destination is never opened for you.",
    steps: ["Upload, drag in or scan a QR code with your camera.", "Read the decoded content shown as plain text.", "Choose to continue to URL analysis.", "Copy the decoded content or download the report."],
    checks: ["Content type detection", "Unsafe schemes (javascript:, data:, file:)", "URL structure and reputation", "Wi-Fi and payment payload warnings"],
    faq: [
      { q: "How can I identify a fake QR code?", a: "Decode it without opening the destination, read the full domain, and look for stickers placed over the original code." },
      { q: "Are my images uploaded?", a: "No. Decoding happens in your browser; only decoded text is sent if you choose to analyze it." },
    ],
    related: "qr-code-safety",
  },
  {
    slug: "domain-intelligence", appPath: "/app/domain-intelligence", module: "04", name: "Domain Intelligence",
    title: "Domain Reputation Checker – RDAP, DNS and SSL Lookup",
    h1: "Investigate a domain",
    description: "Look up RDAP registration data, DNS records, SPF/DMARC, DNSSEC and the TLS certificate for any domain, with lookalike and brand-impersonation analysis.",
    answer: "ScamLens retrieves public registration data via RDAP, DNS records (A, AAAA, MX, NS, TXT, CAA, SPF, DMARC), a DNSSEC validation flag and TLS certificate details, then checks for lookalike and homograph signals. A new domain is not automatically malicious and missing registration fields are not automatically suspicious.",
    steps: ["Enter a domain name.", "Review the registration, DNS and certificate timeline.", "Read lookalike and reputation findings.", "Export the report."],
    checks: ["RDAP creation, update and expiry dates, registrar, status, nameservers", "DNS records, SPF, DMARC, CAA, DNSSEC flag", "Certificate issuer, validity, SAN and hostname match", "Typosquatting, homograph and brand-impersonation signals"],
    faq: [
      { q: "How can I check a domain registration date?", a: "Use the Domain Intelligence tool: it queries RDAP and shows the registration event when the registry publishes it." },
      { q: "What does a suspicious domain mean?", a: "It means signals such as lookalike spelling or a threat listing were found. It is a reason to verify, not proof of fraud." },
    ],
    related: "domain-impersonation",
  },
  {
    slug: "email-header-analyzer", appPath: "/app/email-headers", module: "+", name: "Email Header Analyzer",
    title: "Email Phishing Analyzer – Read SPF, DKIM and DMARC Headers",
    h1: "Analyze raw email headers",
    description: "Paste raw email headers to see SPF, DKIM and DMARC results, the Received chain and From / Reply-To / Return-Path mismatches explained in plain language.",
    answer: "Paste the raw headers of an email and ScamLens parses the Authentication-Results, SPF, DKIM and DMARC outcomes, compares From, Reply-To, Return-Path and Message-ID, walks the Received chain and explains what the headers can and cannot prove. No mailbox access or password is ever required.",
    steps: ["Copy the original headers from your mail client.", "Paste them into the analyzer.", "Review authentication results and mismatches.", "Verify the sender through an official channel."],
    checks: ["SPF, DKIM, DMARC results", "Return-Path and Reply-To differences", "Message-ID format", "Received hop chain", "Display-name spoofing"],
    faq: [{ q: "Can headers be forged?", a: "Yes. Only the lines added by your own receiving mail server are reliable." }],
    related: "how-to-check-if-a-link-is-suspicious",
  },
];

export const getTool = (slug: string) => TOOLS.find((t) => t.slug === slug);

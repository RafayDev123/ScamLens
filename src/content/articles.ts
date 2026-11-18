export interface Article {
  slug: string;
  title: string;
  category: string;
  description: string;
  /** Answer-first summary shown at the top and used in meta description / AEO. */
  answer: string;
  published: string;
  updated: string;
  sections: { h: string; p?: string[]; list?: string[]; table?: { head: string[]; rows: string[][] } }[];
  faq: { q: string; a: string }[];
  references: { label: string; url: string }[];
}

const D = "2026-11-17";
const AUTHOR = "ScamLens Editorial Team";
export const ARTICLE_AUTHOR = AUTHOR;

export const ARTICLES: Article[] = [
  {
    slug: "how-to-check-if-a-link-is-suspicious",
    title: "How to Check Whether a Link Is Suspicious",
    category: "Phishing awareness",
    description: "A step-by-step method for judging a suspicious link before you click: read the domain from the right, check the path, expand shorteners and verify through an official channel.",
    answer: "To check a suspicious link, do not click it. Read the domain name (the part just before the first single slash, ending with the domain extension), look for look-alike spellings, expand any shortened link safely, and confirm the request through the organization's official website or app that you open yourself.",
    published: D, updated: D,
    sections: [
      { h: "Step 1: Find the real domain", p: ["Only the registrable domain – the name plus its ending, such as example.com – decides who controls a website. Everything to the left of it is a subdomain that the domain owner can set freely. In paypal.com.account-check.example.net the owner is example.net, not PayPal."] },
      { h: "Step 2: Look for common tricks", list: ["Look-alike letters (rn instead of m, 0 instead of o, or letters from other alphabets).", "Brand names inside longer domains, such as brandname-secure-login.com.", "An “@” before the host: everything before it is ignored by the browser.", "Raw IP addresses or unusual port numbers instead of a normal domain.", "Shortened links that hide the destination."] },
      { h: "Step 3: Check without opening the page", p: ["Paste the link into a link analyzer such as ScamLens. It inspects the address, compares it with reference brand domains, queries configured threat-intelligence sources and can trace redirects with a restricted fetcher so that the page is never opened in your browser."] },
      { h: "Step 4: Verify through a channel you control", p: ["If the message claims to be from your bank, courier or employer, open their official app or type their known address yourself. Use the phone number printed on your card or on the official website – not one from the message."] },
      { h: "What a clean result does and does not mean", p: ["A link with no known threat is not guaranteed safe. New phishing pages appear faster than they are listed. HTTPS and a padlock only show an encrypted connection."] },
    ],
    faq: [
      { q: "Can I check a link without clicking it?", a: "Yes. Analyze the address itself: its structure, domain, reputation listings and redirect chain can be examined without visiting the page in your browser." },
      { q: "Is a link safe if it starts with https?", a: "No. HTTPS only encrypts the connection. Phishing sites routinely use valid HTTPS certificates." },
      { q: "What should I do if I already clicked?", a: "Do not enter any information. If you did, change the affected password from a trusted device, enable two-factor authentication and contact your bank if card or account details were shared." },
    ],
    references: [
      { label: "FTC – How to recognize and avoid phishing scams", url: "https://consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams" },
      { label: "CISA – Recognize and report phishing", url: "https://www.cisa.gov/secure-our-world/recognize-and-report-phishing" },
      { label: "NCSC (UK) – Phishing: how to report and spot scam emails", url: "https://www.ncsc.gov.uk/collection/phishing-scams" },
    ],
  },
  {
    slug: "fake-banking-messages",
    title: "Fake Banking Messages: How to Recognize and Respond",
    category: "Fake banking messages",
    description: "Learn the warning signs of fake bank SMS, WhatsApp and email messages – from OTP requests to account-blocking threats – and how to verify safely.",
    answer: "A fake banking message pressures you to act quickly and asks for an OTP, PIN, password or a login through a link. Real banks never ask you to share OTPs or PINs. Verify by calling the number on the back of your card or using the bank's official app.",
    published: D, updated: D,
    sections: [
      { h: "Typical patterns", list: ["“Your account will be blocked today – verify now.”", "A link to a page that looks like the bank's login page.", "Requests to “confirm” an OTP you did not request.", "Messages about KYC updates, unusual transactions or card expiry.", "A caller who already knows your name and asks you to move money to a “safe account”."] },
      { h: "Why they work", p: ["Scammers combine urgency, authority and fear. They also copy logos, tone and sender names. Sender names in SMS and email can be forged, so a familiar name does not prove authenticity."] },
      { h: "What to do", list: ["Do not tap links or call numbers in the message.", "Open the bank's app or type its address yourself.", "Call the number on your card.", "Never read out or forward an OTP, PIN or CVV.", "Report the message to your bank and the relevant authority."] },
      { h: "Comparison: genuine vs. fake", table: { head: ["Signal", "Genuine bank", "Typical scam"], rows: [["OTP", "Sent only to you to approve your own action", "Asked to be read out or sent back"], ["Link", "Rarely requires login through a message link", "Login page reached through a link"], ["Tone", "Calm, specific information", "Threats, deadlines, secrecy"], ["Payment", "Never asks you to move money to a safe account", "Asks for urgent transfers"]] } },
    ],
    faq: [
      { q: "Would a bank ever ask for my OTP?", a: "No. An OTP exists to prove that you are approving an action. Anyone asking you to share it wants to approve their own action." },
      { q: "What if the message mentions my real name or account ending?", a: "Criminals buy leaked data. Personal details do not prove a message is genuine." },
    ],
    references: [
      { label: "FTC – Bank impersonator scams", url: "https://consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams" },
      { label: "CISA – Recognize and report phishing", url: "https://www.cisa.gov/secure-our-world/recognize-and-report-phishing" },
    ],
  },
  {
    slug: "online-shopping-safety",
    title: "Online Shopping Safety: Spot Fake Stores Before You Pay",
    category: "Online shopping safety",
    description: "How to evaluate an unfamiliar online shop: domain age signals, payment methods, reviews, contact details and how to pay more safely.",
    answer: "Before buying from an unfamiliar shop, check the domain carefully, look for independent reviews, confirm a real business address and contact method, and pay with a method that offers buyer protection. Prices that are far below market and pressure to pay by transfer or gift card are strong warning signs.",
    published: D, updated: D,
    sections: [
      { h: "Checks before you buy", list: ["Is the domain a near-copy of a well-known store?", "How old is the domain? A very new domain is only a weak signal, but it matters together with other warnings.", "Are there independent reviews outside the shop itself?", "Is there a real company name, address and working contact option?", "Do return and refund terms exist and make sense?"] },
      { h: "Payment safety", list: ["Prefer credit cards or payment services with dispute rights.", "Be wary of shops that accept only bank transfer, crypto or gift cards.", "Never enter card details after following a link from an unexpected message."] },
      { h: "Tools", p: ["Use a domain investigation tool to see registration date, registrar and certificate details. Missing or privacy-redacted registration data is normal and does not prove a shop is fraudulent."] },
    ],
    faq: [
      { q: "Does a padlock mean the shop is real?", a: "No. The padlock only means the connection is encrypted." },
      { q: "Is a new domain always a scam?", a: "No. New businesses register new domains. Combine age with other evidence." },
    ],
    references: [{ label: "FTC – Online shopping", url: "https://consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams" }, { label: "NCSC (UK) – Shopping online securely", url: "https://www.ncsc.gov.uk/collection/top-tips-for-staying-secure-online" }],
  },
  {
    slug: "qr-code-safety",
    title: "QR Code Safety: How to Identify a Fake or Malicious QR Code",
    category: "QR code safety",
    description: "QR codes hide their destination. Learn how to inspect where a QR code leads, spot tampered stickers and avoid payment and login traps.",
    answer: "A QR code is only an encoded piece of text, most often a web address. To identify a fake QR code, decode it without opening the destination, read the domain carefully, be suspicious of stickers placed over other codes, and never scan a code to “receive” money.",
    published: D, updated: D,
    sections: [
      { h: "Why QR codes are risky", p: ["You cannot read a QR code with your eyes, so the destination is invisible until you scan. Attackers stick fake codes over real ones on parking meters, posters or menus, or send codes by email."] },
      { h: "How to check safely", list: ["Use a checker that decodes the image locally and shows the content before opening anything.", "Read the full domain, not just the start.", "Check for a physical sticker over the original code.", "Treat codes that ask you to log in, install an app or pay as higher risk."] },
      { h: "Different QR contents", table: { head: ["Content", "What it can do", "Risk"], rows: [["Website URL", "Opens a page", "Phishing, malware downloads"], ["Wi-Fi", "Pre-fills network and password", "Joining a malicious hotspot"], ["Payment", "Pre-fills a payee and amount", "Paying the wrong person"], ["Phone / SMS", "Dials or composes a message", "Premium-rate calls, smishing"]] } },
    ],
    faq: [
      { q: "Can a QR code infect my phone just by scanning?", a: "Scanning only reads text. Harm usually comes from what you then open, install or enter. Keep your camera app and OS updated." },
      { q: "Is it safe to upload a QR image to a checker?", a: "Prefer tools that decode locally in your browser. ScamLens never uploads the image; only decoded text is sent if you choose to analyze it." },
    ],
    references: [{ label: "FTC – Scammers use QR codes to steal your information", url: "https://consumer.ftc.gov/articles/scammers-use-qr-codes-steal-your-information" }, { label: "CISA – Recognize and report phishing", url: "https://www.cisa.gov/secure-our-world/recognize-and-report-phishing" }],
  },
  {
    slug: "job-scam-awareness",
    title: "Job Scam Awareness: Fake Offers, Task Scams and Advance Fees",
    category: "Job scam awareness",
    description: "Recognize fake job offers: unrealistic pay, chat-app interviews, upfront fees and requests for ID documents.",
    answer: "A job scam promises high pay for little work and then asks you to pay a fee, buy equipment, move money or send ID documents. Real employers do not charge you to hire you. Verify the company independently before sharing documents or paying anything.",
    published: D, updated: D,
    sections: [
      { h: "Red flags", list: ["Contact starts on WhatsApp or Telegram with no prior application.", "Pay is far above the market rate for easy tasks such as liking videos.", "You must pay for training, a laptop or a “security deposit”.", "You are asked to receive and forward money.", "Interviews take place only by chat."] },
      { h: "How to verify an employer", list: ["Find the company's official website yourself and contact it using details listed there.", "Search for the exact job on the company's careers page.", "Check whether the recruiter's email domain matches the company's domain."] },
      { h: "If you already shared documents", p: ["Contact the relevant identity authority and your bank, monitor accounts and change passwords."] },
    ],
    faq: [{ q: "Is it normal to pay a registration fee for a job?", a: "No. Legitimate employers cover hiring costs." }, { q: "What is a task scam?", a: "A scheme that pays small amounts at first for simple online tasks, then demands larger deposits that are never returned." }],
    references: [{ label: "FTC – Job scams", url: "https://consumer.ftc.gov/articles/job-scams" }, { label: "NCSC (UK) – Phishing scams", url: "https://www.ncsc.gov.uk/collection/phishing-scams" }],
  },
  {
    slug: "domain-impersonation",
    title: "Domain Impersonation: Typosquatting, Homographs and Lookalike Domains",
    category: "Domain impersonation",
    description: "How attackers register domains that imitate real brands and how to detect typosquatting, homograph and misleading-subdomain tricks.",
    answer: "Domain impersonation means registering a web address that looks like a trusted brand's. Common techniques are typos (paypa1.com), look-alike characters from other alphabets, extra words (brand-support.com) and misleading subdomains (brand.com.example.net). Similarity is a signal, not proof of intent.",
    published: D, updated: D,
    sections: [
      { h: "Techniques", table: { head: ["Technique", "Example pattern", "What to check"], rows: [["Typosquatting", "Swapped, missing or doubled letters", "Compare letter by letter"], ["Character substitution", "0 for o, 1 for l, rn for m", "Read slowly in a monospace font"], ["Homograph (IDN)", "Cyrillic а replacing Latin a", "Look at the xn-- punycode form"], ["Extra words", "brand-login.com", "Official brands rarely use hyphenated login domains"], ["Misleading subdomain", "brand.com.evil.net", "Read the domain from right to left"]] } },
      { h: "Punycode and internationalized domains", p: ["Internationalized domain names are encoded as ASCII beginning with xn--. Browsers may show the readable form, which is why mixed-alphabet labels are treated as high-risk indicators."] },
      { h: "Responsible interpretation", p: ["A similar name may also belong to a legitimate regional site, a reseller or the brand's own defensive registration. ScamLens reports similarity and never claims affiliation or malicious intent from similarity alone."] },
    ],
    faq: [{ q: "How do I check who owns a domain?", a: "Query its RDAP record for registrar, dates and status. Registrant details are often redacted for privacy." }],
    references: [{ label: "RFC 7480 – HTTP usage in RDAP", url: "https://datatracker.ietf.org/doc/html/rfc7480" }, { label: "ICANN – Internationalized domain names", url: "https://www.icann.org/resources/pages/idn-2012-02-25-en" }],
  },
  {
    slug: "password-and-otp-safety",
    title: "Password and OTP Safety: What You Should Never Share",
    category: "Password and OTP safety",
    description: "Understand why one-time passcodes and passwords must never be shared, and how to protect accounts with unique passwords and multi-factor authentication.",
    answer: "Never share passwords, one-time passcodes (OTPs), PINs or CVV numbers with anyone who contacts you. Use a unique password for each account, a password manager and multi-factor authentication, and approve only login or payment requests that you started yourself.",
    published: D, updated: D,
    sections: [
      { h: "Why OTPs matter", p: ["An OTP is the final proof that you approve an action. If a scammer triggers a login or payment and then asks you to read out the code, they complete the action in your name."] },
      { h: "Good habits", list: ["Unique, long passphrases for every important account.", "A reputable password manager.", "Multi-factor authentication, preferably with an authenticator app or security key.", "Never approve unexpected prompts.", "Check the sender through official channels."] },
      { h: "If you shared a code", list: ["Contact your bank or provider immediately.", "Change passwords from a trusted device.", "Review recent activity and sign out of all sessions."] },
    ],
    faq: [{ q: "Can support staff ask for my OTP?", a: "No. Genuine support never needs your OTP, password or PIN." }],
    references: [{ label: "CISA – Use strong passwords", url: "https://www.cisa.gov/secure-our-world/use-strong-passwords" }, { label: "CISA – Turn on MFA", url: "https://www.cisa.gov/secure-our-world/turn-mfa" }],
  },
  {
    slug: "safe-online-payments",
    title: "Safe Online Payments: Protect Yourself When Paying Digitally",
    category: "Safe online payments",
    description: "Practical rules for paying safely online: payment methods with protection, verifying payees, avoiding irreversible transfers and spotting fake payment requests.",
    answer: "Pay safely by using methods with dispute rights, verifying the payee before you send money, avoiding gift cards and urgent bank transfers, and entering card details only on sites you reached by typing the address yourself.",
    published: D, updated: D,
    sections: [
      { h: "Rules of thumb", list: ["Prefer cards or services that allow chargebacks.", "Verify account names shown in your banking app before confirming.", "Be careful with “receive money” QR codes – scanning to receive does not require paying.", "Avoid irreversible payments to people you have not met.", "Enable payment notifications and set limits."] },
      { h: "Spotting fake payment requests", p: ["Invoices with changed bank details, urgent requests from a “manager”, or payment links in unexpected messages are common. Confirm changes by phone using a number you already trust."] },
      { h: "For small businesses", p: ["Use a second-person approval for new payees and bank-detail changes, and train staff on invoice fraud."] },
    ],
    faq: [{ q: "Which payment methods are riskiest?", a: "Gift cards, crypto and instant transfers are hardest to reverse, which is why scammers ask for them." }],
    references: [{ label: "FTC – How to avoid a scam", url: "https://consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams" }, { label: "NCSC (UK) – Business email compromise", url: "https://www.ncsc.gov.uk/collection/phishing-scams" }],
  },
];

export const GLOSSARY: { term: string; def: string }[] = [
  { term: "Phishing", def: "A fraudulent message that tricks you into revealing credentials, money or personal data." },
  { term: "Smishing", def: "Phishing delivered by SMS or chat apps." },
  { term: "Typosquatting", def: "Registering a domain that differs from a real one by a small typing error." },
  { term: "Homograph attack", def: "Using characters from other alphabets that look identical to Latin letters." },
  { term: "RDAP", def: "Registration Data Access Protocol – the standard, JSON-based successor to WHOIS for domain registration data." },
  { term: "SPF / DKIM / DMARC", def: "Email authentication standards that let domains publish who may send mail for them." },
  { term: "Punycode", def: "An ASCII encoding (xn--…) of internationalized domain names." },
];

export const getArticle = (slug: string) => ARTICLES.find((a) => a.slug === slug);

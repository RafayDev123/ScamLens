import { redactText, truncate } from "@/lib/security/redact";
import type { Severity } from "@/lib/types";
import { extractUrls } from "./extract";
import { analyzeUrlStructure, parseSubmittedUrl, type RawFinding } from "./url";

export type Lang = "english" | "urdu" | "roman-urdu";

export function detectLanguage(text: string): Lang {
  const arabic = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const letters = (text.match(/\p{L}/gu) ?? []).length || 1;
  if (arabic / letters > 0.3) return "urdu";
  const romanWords = /\b(aap|ap|apka|apki|apke|hai|hain|nahi|nahin|kar|karein|karo|kijiye|bhej|bhejain|bhejein|bataen|batayen|bata|jaldi|abhi|mubarak|inaam|inam|jeeta|jeet|ka|ki|ke|ko|se|mein|main|hamara|hamari|agar|warna|band|ho|jaye|jayega|kripya|meharbani|janab|rupay|paisay|paise|account|beech|dobara)\b/gi;
  const hits = (text.match(romanWords) ?? []).length;
  return hits >= 3 ? "roman-urdu" : "english";
}

interface Rule {
  code: string;
  title: string;
  severity: Severity;
  confidence: "low" | "medium" | "high";
  /** Regex patterns for English, Urdu script and Roman Urdu. */
  patterns: RegExp[];
  why: string;
  action: string;
  category: string;
  /** A "tactic" rule counts towards the combination finding. */
  tactic?: boolean;
}

const S = "[^\\n]{0,45}";
const RULES: Rule[] = [
  {
    code: "msg.otp_request", title: "Asks for a one-time code, PIN or password", severity: "high", confidence: "high", category: "credentials", tactic: true,
    patterns: [
      new RegExp(`\\b(otp|one[- ]time (?:pass(?:word|code)|code)|verification code|security code|pin(?: code)?|cvv|password|passcode)\\b${S}\\b(send|share|give|provide|tell|reply|forward|read out|confirm|enter|submit)\\b`, "i"),
      new RegExp(`\\b(send|share|give|provide|tell|reply|forward|read out|confirm|submit)\\b${S}\\b(otp|one[- ]time (?:pass(?:word|code)|code)|verification code|security code|pin|cvv|password|passcode)\\b`, "i"),
      /(او ?ٹی ?پی|پن کوڈ|پاس ?ورڈ|کوڈ)[^\n]{0,40}(بتائیں|بھیجیں|شیئر|دیں|بتادیں)/u,
      /(بتائیں|بھیجیں|شیئر|دیں)[^\n]{0,40}(او ?ٹی ?پی|پن|پاس ?ورڈ|کوڈ)/u,
      /\b(otp|pin|password|code|cvv)\b[^\n]{0,30}\b(bata|batao|batayen|bataen|bhej|bhejo|bhejein|bhejain|share|send|de do|dein|dedo)\b/i,
      /\b(bata|batao|batayen|bhej|bhejo|bhejein|share|send)\b[^\n]{0,30}\b(otp|pin|password|code|cvv)\b/i,
    ],
    why: "Real banks, couriers and platforms never ask you to read out or send a one-time code, PIN or password. Anyone who has your OTP can approve payments or take over your account.",
    action: "Do not share the code. Contact the organization using the number printed on your card or on its official website.",
  },
  {
    code: "msg.account_threat", title: "Threatens account suspension, blocking or legal action", severity: "medium", confidence: "medium", category: "pressure", tactic: true,
    patterns: [
      /\b(account|card|sim|wallet|number)\b[^\n]{0,50}\b(will be |has been |is )?(suspend(?:ed)?|block(?:ed)?|clos(?:ed|ure)|deactivat(?:ed|ion)|terminat(?:ed|ion)|restrict(?:ed)?|locked|limited)\b/i,
      /\b(legal action|arrest|police case|warrant|court notice|penalty)\b/i,
      /(اکاؤنٹ|کارڈ|سم)[^\n]{0,40}(بند|معطل|بلاک|منسوخ)/u,
      /\b(account|card|sim)\b[^\n]{0,30}\b(band|block|suspend)\b[^\n]{0,20}\b(ho jaye|ho jayega|kar diya|kar di jaye)\b/i,
      /\b(band ho (?:jaye|jayega|jayegi)|block ho (?:jaye|jayega|jayegi))\b/i,
    ],
    why: "Threats of closing your account or legal consequences are used to make you act before thinking. Genuine organizations normally notify you inside their official app or website too.",
    action: "Open the official app or type the website address yourself to check your account status.",
  },
  {
    code: "msg.urgency", title: "Urgent time pressure", severity: "low", confidence: "low", category: "pressure", tactic: true,
    patterns: [
      /\b(urgent(?:ly)?|immediately|right now|within (?:\d+|one|two|24|48) ?(?:hours?|hrs?|minutes?|mins?)|act now|final notice|last warning|expires? (?:today|soon|tonight)|asap|today only|limited time)\b/i,
      /(فوری|جلدی|فوراً|آخری موقع|24 ?گھنٹے)/u,
      /\b(jaldi|abhi|foran|fori|aaj hi|24 ?ghante|ghanton mein|aakhri moka|aakhri mauka)\b/i,
    ],
    why: "Urgency alone is common in honest messages (appointments, deliveries). It becomes a warning sign when combined with requests for money, codes or links.",
    action: "Pause. A real deadline can be confirmed through the organization's official channel.",
  },
  {
    code: "msg.bank_impersonation", title: "Claims to come from a bank or payment service", severity: "medium", confidence: "medium", category: "impersonation", tactic: true,
    patterns: [
      /\b(dear (?:valued )?customer|your (?:bank|debit|credit) (?:account|card)|bank (?:alert|notice|security|team|support)|(?:hbl|ubl|meezan|allied bank|mcb|faysal|bank alfalah|habib bank|easypaisa|jazzcash|sadapay|nayapay|paypal|chase|wells fargo|hsbc|barclays|citibank|bank of america)\b[^\n]{0,60}\b(alert|verify|suspend|unusual|blocked|update|kyc))/i,
      /\bkyc\b[^\n]{0,40}\b(expire|update|verify|pending|incomplete)\b/i,
      /(بینک|ایزی ?پیسہ|جاز ?کیش)[^\n]{0,60}(تصدیق|اپڈیٹ|بلاک|معطل)/u,
      /\b(bank|easypaisa|jazzcash|hbl|ubl|meezan)\b[^\n]{0,50}\b(verify|tasdeeq|update|block|kyc)\b/i,
    ],
    why: "Scammers copy the tone and logos of banks and wallets. They rely on you not checking whether the message really came from your bank.",
    action: "Do not use links or numbers from the message. Call the bank using the number on the back of your card.",
  },
  {
    code: "msg.courier", title: "Fake delivery / courier notification pattern", severity: "medium", confidence: "medium", category: "impersonation", tactic: true,
    patterns: [
      /\b(parcel|package|shipment|delivery|courier|consignment)\b[^\n]{0,70}\b(failed|held|on hold|pending|unable to deliver|address (?:issue|incomplete)|reschedule|customs|redeliver|fee|charge|pay)\b/i,
      /\b(dhl|fedex|ups|usps|tcs|leopards|royal mail|postex|trax|bluex)\b[^\n]{0,70}\b(fee|pay|reschedule|confirm|address|customs|held)\b/i,
      /(پارسل|ڈیلیوری|کوریئر)[^\n]{0,50}(فیس|ایڈریس|ناکام|رکا|کسٹم)/u,
      /\b(parcel|courier|delivery)\b[^\n]{0,50}\b(fee|charges|address|customs)\b/i,
    ],
    why: "Delivery scams ask for a small “redelivery” or customs fee, or an address confirmation, to steal card details. Real couriers tell you tracking details inside their own app or site.",
    action: "Check the tracking number on the courier's official website. Never pay a fee through a link in a message.",
  },
  {
    code: "msg.prize", title: "Unexpected prize, reward or giveaway", severity: "high", confidence: "medium", category: "lure", tactic: true,
    patterns: [
      /\b(you(?:'ve| have)? (?:won|been selected|been chosen)|congratulations|winner|lottery|jackpot|lucky draw|gift card|free (?:iphone|gift|prize)|claim your (?:prize|reward|gift)|cash prize)\b/i,
      /(مبارک|انعام|لاٹری|جیت|قرعہ اندازی|بے نظیر انکم|احساس پروگرام|8171)/u,
      /\b(mubarak|mubarik|inaam|inam|lottery|jeet(?:a|e|ay)? (?:gaye|gaya|liya)|lucky draw|bisp|benazir income|ehsaas|8171)\b/i,
    ],
    why: "You cannot win a contest you did not enter. Prize and benefit-program messages are used to collect fees, personal data or card numbers.",
    action: "Ignore it. Check government benefit programs only through their official portal or helpline.",
  },
  {
    code: "msg.advance_fee", title: "Asks you to pay a fee to receive money, a job or a prize", severity: "high", confidence: "medium", category: "payment", tactic: true,
    patterns: [
      /\b(processing|registration|clearance|customs|release|insurance|handling|activation|admin|delivery|security deposit|tax) (?:fee|fees|charge|charges|payment|deposit)\b/i,
      /\b(pay|send|transfer|deposit)\b[^\n]{0,50}\b(fee|fees|charges|deposit|tax)\b[^\n]{0,50}\b(to (?:receive|claim|release|unlock|activate|get)|before (?:you|we|funds))\b/i,
      /(فیس|چارجز|ٹیکس)[^\n]{0,50}(جمع|بھیج|ادا)/u,
      /\b(fees?|charges|tax)\b[^\n]{0,30}\b(jama|bhej|bhejain|bhejein|ada)\b[^\n]{0,20}\b(karwa|karein|kar|karo|karen)\b/i,
    ],
    why: "Advance-fee fraud asks you to send money first in exchange for a much larger payout or opportunity that never arrives.",
    action: "Do not pay. Legitimate employers, lotteries and agencies do not charge you to receive money or a job.",
  },
  {
    code: "msg.payment_instruction", title: "Unusual payment instructions", severity: "medium", confidence: "medium", category: "payment", tactic: true,
    patterns: [
      /\b(gift ?cards?|itunes card|google play card|steam card|bitcoin|btc|usdt|crypto(?:currency)?|western union|moneygram|wire transfer|binance wallet)\b/i,
      /\b(send|transfer|pay|deposit)\b[^\n]{0,40}\b(easypaisa|jazzcash|raast|sadapay|nayapay|upi|zelle|cash ?app|venmo|account (?:no|number)|iban)\b/i,
      /(ایزی ?پیسہ|جاز ?کیش)[^\n]{0,40}(بھیج|ٹرانسفر)/u,
      /\b(easypaisa|jazzcash|raast)\b[^\n]{0,40}\b(bhej|transfer|karein|karen)\b/i,
    ],
    why: "Gift cards, crypto and instant wallet transfers are hard to reverse, so fraudsters prefer them. Legitimate bills are rarely paid with gift cards.",
    action: "Confirm the payee and amount with the organization through a trusted channel before sending anything.",
  },
  {
    code: "msg.job_scam", title: "Job-offer scam pattern", severity: "medium", confidence: "medium", category: "lure", tactic: true,
    patterns: [
      /\b(work from home|earn (?:up to )?(?:\$|rs\.?|usd|pkr)?\s?\d[\d,]*(?:\s?(?:per|a|\/) ?(?:day|hour|week))|no experience (?:needed|required)|easy money|part[- ]time job|data entry|online task|like (?:and|&) (?:subscribe|follow)|(?:whatsapp|telegram) (?:us|me|to apply|for details)|hiring urgently)\b/i,
      /(گھر بیٹھے|آن لائن کام|پارٹ ٹائم|روزانہ کمائیں|ملازمت)/u,
      /\b(ghar baithe|ghar bethe|online kaam|part time job|daily kamaen|roz kamaen|kamai|job offer)\b/i,
    ],
    why: "Fake job offers promise easy, high pay for simple tasks. They often move to chat apps, then ask for a deposit, “training fee” or personal documents.",
    action: "Research the company independently. Never pay to get a job or share ID documents before a verified contract.",
  },
  {
    code: "msg.personal_info", title: "Requests personal or identity information", severity: "high", confidence: "medium", category: "credentials", tactic: true,
    patterns: [
      /\b(send|share|provide|confirm|enter|verify|update|submit)\b[^\n]{0,40}\b(cnic|national id|id card|passport|ssn|social security|date of birth|dob|mother'?s maiden|card number|debit card|credit card|account number|iban|selfie|full name and address)\b/i,
      /(شناختی کارڈ|سی این آئی سی|کارڈ نمبر|اکاؤنٹ نمبر)[^\n]{0,40}(بھیج|بتائیں|شیئر|دیں)/u,
      /\b(cnic|shanakhti card|card number|account number)\b[^\n]{0,30}\b(bhej\w*|bata\w*|share|send|dein|do)\b/i,
    ],
    why: "Identity and card details can be used for account takeover, SIM-swap and payment fraud.",
    action: "Do not send identity or card details by message. Provide them only on official sites you opened yourself.",
  },
  {
    code: "msg.impersonation", title: "Unexpected claim of identity or relationship", severity: "medium", confidence: "low", category: "impersonation", tactic: true,
    patterns: [
      /\b(hi (?:mum|mom|dad)|this is my new number|i(?:'m| am) your (?:son|daughter|boss|ceo|manager)|new whatsapp number|lost my phone|(?:ceo|director|manager)\b[^\n]{0,30}\b(gift cards?|wire|urgent task))\b/i,
      /\b(this is (?:the )?(?:fbr|nadra|pta|fia|police|customs|irs|hmrc)|(?:fbr|nadra|pta|fia|irs|hmrc|ministry)\b[^\n]{0,30}\b(notice|case|summons|refund))\b/i,
      /(میرا نیا نمبر|میں آپ کا بیٹا|یہ ایف بی آر|نادرا کی طرف سے|ایف آئی اے)/u,
      /\b(mera naya number|ye mera naya|main aap ka beta|nadra se|fbr se|fia se)\b/i,
    ],
    why: "Impersonating relatives, executives or officials is a common way to create trust or fear. Anyone can type a name or claim a title.",
    action: "Call the person on a number you already know, or contact the agency through its official website.",
  },
  {
    code: "msg.secrecy", title: "Asks you to keep it secret or avoid verification", severity: "medium", confidence: "medium", category: "pressure", tactic: true,
    patterns: [
      /\b(don'?t tell (?:anyone|anybody)|keep (?:this|it) (?:secret|confidential|between us)|do not (?:contact|call|inform) (?:the )?(?:bank|police|anyone)|do not discuss)\b/i,
      /(کسی کو (?:مت|نہ) بتا|راز میں رکھ)/u,
      /\b(kisi ko (?:mat|na) bata|raaz mein rakh|kisi se baat mat)\b/i,
    ],
    why: "Scammers isolate victims so friends, family or the bank cannot warn them.",
    action: "Talk to someone you trust and contact the real organization before acting.",
  },
  {
    code: "msg.remote_access", title: "Asks you to install remote-access software", severity: "high", confidence: "medium", category: "credentials", tactic: true,
    patterns: [/\b(anydesk|teamviewer|ultraviewer|quick ?support|remote (?:access|support|control)|install (?:this )?app to (?:verify|refund|claim))\b/i],
    why: "Remote-access tools give full control of your device, including banking apps. Fraudsters use them in refund and tech-support scams.",
    action: "Never install remote-control software at the request of an unexpected caller or message.",
  },
  {
    code: "msg.investment", title: "Guaranteed-return investment pitch", severity: "medium", confidence: "medium", category: "lure", tactic: true,
    patterns: [/\b(guaranteed (?:returns?|profit)|double your (?:money|investment)|risk[- ]free|100% (?:profit|return)|insider (?:tip|signal)|crypto (?:signal|giveaway)|daily profit)\b/i, /\b(guaranteed munafa|paisay double|double paisa|munafa guarantee)\b/i],
    why: "No legitimate investment can guarantee profit. “Guaranteed” returns are the signature of investment and crypto scams.",
    action: "Check whether the platform is registered with your financial regulator before sending money.",
  },
];

export interface MessageAnalysis {
  language: Lang;
  redacted: string;
  findings: RawFinding[];
  urls: { raw: string; display: string; host: string; localRisk: Severity; indicators: string[] }[];
  length: number;
}

const ORDER: Severity[] = ["info", "low", "medium", "high", "critical"];

export function analyzeMessage(text: string): MessageAnalysis {
  const redacted = redactText(text);
  const language = detectLanguage(text);
  const findings: RawFinding[] = [];
  const hitCategories = new Set<string>();
  const strongTactics: string[] = [];

  for (const rule of RULES) {
    for (const re of rule.patterns) {
      const m = re.exec(redacted);
      if (!m) continue;
      const snippet = truncate(m[0].replace(/\s+/g, " ").trim(), 160);
      findings.push({
        code: rule.code,
        title: rule.title,
        severity: rule.severity,
        confidence: rule.confidence,
        evidence: snippet,
        explanation: rule.why,
        source: "local-message-rules",
        action: rule.action,
        category: rule.category,
      });
      hitCategories.add(rule.code);
      if (rule.code !== "msg.urgency" && ORDER.indexOf(rule.severity) >= 2) strongTactics.push(rule.code);
      break;
    }
  }

  // Embedded URLs – local structural analysis only (nothing is contacted).
  const urls: MessageAnalysis["urls"] = [];
  for (const raw of extractUrls(text).slice(0, 10)) {
    const parsed = parseSubmittedUrl(raw);
    if (!parsed.ok) continue;
    const a = analyzeUrlStructure(parsed.url);
    const risk = a.findings.reduce<Severity>((m, f) => (ORDER.indexOf(f.severity) > ORDER.indexOf(m) ? f.severity : m), "info");
    const display = redactText(raw);
    urls.push({ raw, display, host: a.parts.host, localRisk: risk, indicators: a.findings.map((f) => f.title) });
    const meaningful = a.findings.filter((f) => f.severity !== "info" && f.code !== "url.no_https");
    if (a.shortener) {
      findings.push({ code: "msg.short_link", title: "Shortened link inside the message", severity: "medium", confidence: "medium", evidence: display, explanation: "The real destination of a shortened link is hidden. Scam messages commonly use them to avoid detection and to hide look-alike domains.", source: "local-message-rules", action: "Do not tap it. Analyze the link first to reveal where it goes.", relatedUrl: display, category: "link" });
    } else if (meaningful.some((f) => ORDER.indexOf(f.severity) >= 2)) {
      const worst = meaningful.sort((x, y) => ORDER.indexOf(y.severity) - ORDER.indexOf(x.severity))[0];
      findings.push({ code: "msg.suspicious_link", title: `Link in message looks suspicious: ${worst.title}`, severity: worst.severity === "high" ? "high" : "medium", confidence: worst.confidence, evidence: display, explanation: worst.explanation, source: "local-message-rules", action: worst.action, relatedUrl: display, category: "link" });
    }
  }
  if (urls.length && strongTactics.length) {
    findings.push({ code: "msg.link_plus_pressure", title: "Link combined with scam-style wording", severity: "medium", confidence: "medium", evidence: `${urls.length} link(s) + ${strongTactics.length} warning pattern(s)`, explanation: "A link by itself is normal. A link that arrives together with pressure, payment or credential requests is the standard shape of a phishing message.", source: "local-message-rules", action: "Analyze the link separately and verify the sender before opening it.", category: "link" });
  }
  // Combination: urgency alone stays low; urgency + other tactics escalates.
  if (strongTactics.length >= 2) {
    findings.push({ code: "msg.multiple_tactics", title: "Several social-engineering tactics combined", severity: "high", confidence: "medium", evidence: [...new Set(strongTactics)].map((c) => c.replace("msg.", "").replace(/_/g, " ")).join(" + "), explanation: "Individually these patterns can appear in honest messages. Together – pressure, impersonation and a request for money, codes or data – they match the structure of known scams.", source: "local-message-rules", action: "Stop and verify through an official channel before responding.", category: "combination" });
  }
  return { language, redacted, findings, urls, length: text.length };
}

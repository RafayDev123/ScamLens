import { describe, expect, it } from "vitest";
import { analyzeMessage, detectLanguage } from "@/lib/analysis/message";
import { extractUrls } from "@/lib/analysis/extract";

const codes = (t: string) => analyzeMessage(t).findings.map((f) => f.code);

describe("message analyzer", () => {
  it("finds nothing in a harmless message", () => {
    expect(codes("Hi Sara, are we still meeting for lunch on Friday at the usual place?")).toEqual([]);
  });
  it("does not treat urgency alone as a scam", () => {
    const f = analyzeMessage("Please reply urgently, the meeting starts in 10 minutes.").findings;
    expect(f.map((x) => x.code)).toEqual(["msg.urgency"]);
    expect(f[0].severity).toBe("low");
  });
  it("detects an OTP request + account threat + link combination", () => {
    const c = codes("URGENT: Your HBL account will be blocked today. Share your OTP now and verify at http://hbl-secure-login.example.top/verify");
    expect(c).toEqual(expect.arrayContaining(["msg.otp_request", "msg.account_threat", "msg.multiple_tactics"]));
  });
  it("detects Urdu scam wording", () => {
    const t = "آپ کا اکاؤنٹ بند ہو جائے گا۔ فوری طور پر اپنا او ٹی پی بھیجیں";
    expect(detectLanguage(t)).toBe("urdu");
    expect(codes(t)).toEqual(expect.arrayContaining(["msg.otp_request", "msg.account_threat"]));
  });
  it("detects Roman Urdu scam wording", () => {
    const t = "Mubarak ho aap ne inaam jeet liya hai. Apna CNIC bhejein aur fees jama karwain abhi";
    expect(detectLanguage(t)).toBe("roman-urdu");
    expect(codes(t)).toEqual(expect.arrayContaining(["msg.prize", "msg.personal_info"]));
  });
  it("extracts and locally assesses embedded URLs, flagging shorteners", () => {
    const a = analyzeMessage("Track your parcel: bit.ly/3xYzAb or https://example.com/track.");
    expect(a.urls.length).toBe(2);
    expect(a.findings.map((f) => f.code)).toContain("msg.short_link");
    expect(extractUrls("see www.example.com/a, ok")).toEqual(["https://www.example.com/a"]);
  });
  it("redacts digits, emails and URL secrets before analysis/storage", () => {
    const a = analyzeMessage("Your code 123456 sent to bob@example.com see https://x.example.com/?token=abc123");
    expect(a.redacted).not.toMatch(/123456|bob@|abc123/);
  });
  it("escapes nothing itself – evidence is plain text (React escapes on render)", () => {
    const a = analyzeMessage("Share your <script>alert(1)</script> OTP immediately");
    expect(a.findings[0].evidence).toContain("<script>");
  });
});

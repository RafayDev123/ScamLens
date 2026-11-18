import { describe, expect, it } from "vitest";
import { isPublicIp } from "@/lib/security/ip";
import { BlockedTargetError, inspectRedirects, resolvePublic, validateOutboundUrl, type HopRequester } from "@/lib/security/ssrf";

describe("SSRF: address classification", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "2001:db8::1", "64:ff9b::7f00:1"])("blocks %s", (ip) => expect(isPublicIp(ip)).toBe(false));
  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111"])("allows %s", (ip) => expect(isPublicIp(ip)).toBe(true));
});

describe("SSRF: outbound URL validation", () => {
  it("rejects non-http schemes, credentials and odd ports", () => {
    for (const u of ["file:///etc/passwd", "gopher://x.com", "http://user:pw@example.com", "http://example.com:22", "http://example.com:6379"]) expect(() => validateOutboundUrl(u)).toThrow(BlockedTargetError);
  });
  it("normalizes obfuscated IPs before validation (decimal / hex / octal)", async () => {
    for (const u of ["http://2130706433/", "http://0x7f.1/", "http://017700000001/", "http://127.1/"]) {
      const url = validateOutboundUrl(u);
      await expect(resolvePublic(url.hostname)).rejects.toThrow(BlockedTargetError);
    }
  });
  it("blocks localhost-style and internal names without resolving", async () => {
    for (const h of ["localhost", "foo.localhost", "db.internal", "printer.local", "intranet"]) await expect(resolvePublic(h, async () => { throw new Error("must not resolve"); })).rejects.toThrow(BlockedTargetError);
  });
  it("blocks cloud metadata endpoints", async () => {
    await expect(resolvePublic("169.254.169.254")).rejects.toThrow(BlockedTargetError);
    await expect(resolvePublic("[fd00:ec2::254]")).rejects.toThrow(BlockedTargetError);
  });
});

describe("SSRF: DNS rebinding", () => {
  it("rejects a host when ANY returned record is private", async () => {
    const resolver = async () => [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }];
    await expect(resolvePublic("rebind.example.com", resolver)).rejects.toThrow(BlockedTargetError);
  });
  it("pins the connection to the single validated resolution (resolver called once per hop)", async () => {
    let calls = 0;
    const resolver = async () => { calls++; return [{ address: "93.184.216.34", family: 4 }]; };
    const seen: string[] = [];
    const requester: HopRequester = async (_u, pinned) => { seen.push(pinned.address); return { status: 200, location: null }; };
    const t = await inspectRedirects("https://example.com/", { resolver, requester });
    expect(t.complete).toBe(true);
    expect(calls).toBe(1);
    expect(seen).toEqual(["93.184.216.34"]);
  });
});

describe("SSRF: redirect validation", () => {
  it("re-validates every hop: redirect to an internal address is refused", async () => {
    const resolver = async (h: string) => (h === "internal.example.com" ? [{ address: "192.168.0.10", family: 4 }] : [{ address: "93.184.216.34", family: 4 }]);
    const requester: HopRequester = async (u) => (u.hostname === "start.example.com" ? { status: 302, location: "http://internal.example.com/admin" } : { status: 200, location: null });
    const t = await inspectRedirects("http://start.example.com/", { resolver, requester });
    expect(t.complete).toBe(false);
    expect(t.stopReason).toBe("blocked:non_public_address");
    expect(t.hops.at(-1)?.status).toBeNull();
  });
  it("refuses redirects to metadata IPs and non-http schemes", async () => {
    const resolver = async () => [{ address: "93.184.216.34", family: 4 }];
    for (const loc of ["http://169.254.169.254/latest/meta-data/", "file:///etc/passwd", "http://localhost:8080/"]) {
      const requester: HopRequester = async (u) => (u.hostname === "start.example.com" ? { status: 301, location: loc } : { status: 200, location: null });
      const t = await inspectRedirects("http://start.example.com/", { resolver, requester });
      expect(t.complete).toBe(false);
      expect(t.stopReason.startsWith("blocked:")).toBe(true);
    }
  });
  it("limits redirect count and detects loops", async () => {
    const resolver = async () => [{ address: "93.184.216.34", family: 4 }];
    let n = 0;
    const chain: HopRequester = async () => ({ status: 302, location: `http://e.example.com/${++n}` });
    const t = await inspectRedirects("http://e.example.com/0", { resolver, requester: chain, maxRedirects: 3 });
    expect(t.stopReason).toBe("max_redirects");
    expect(t.hops.length).toBeLessThanOrEqual(4);
    const loop: HopRequester = async () => ({ status: 302, location: "http://e.example.com/same" });
    expect((await inspectRedirects("http://e.example.com/same", { resolver, requester: loop })).stopReason).toBe("redirect_loop");
  });
  it("enforces the total timeout", async () => {
    const resolver = async () => [{ address: "93.184.216.34", family: 4 }];
    const slow: HopRequester = async () => { await new Promise((r) => setTimeout(r, 60)); return { status: 302, location: `http://e.example.com/${Math.random()}` }; };
    const t = await inspectRedirects("http://e.example.com/", { resolver, requester: slow, totalTimeoutMs: 100 });
    expect(t.stopReason).toBe("total_timeout");
  });
  it("redacts secrets in the recorded chain", async () => {
    const resolver = async () => [{ address: "93.184.216.34", family: 4 }];
    const requester: HopRequester = async () => ({ status: 200, location: null });
    const t = await inspectRedirects("https://example.com/x?token=SUPERSECRET", { resolver, requester });
    expect(JSON.stringify(t.hops)).not.toContain("SUPERSECRET");
  });
});

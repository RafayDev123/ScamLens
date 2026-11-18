import { BlockList, isIP } from "node:net";

/**
 * Every non-public address range we refuse to contact. Covers loopback,
 * private, link-local (incl. cloud metadata 169.254.169.254), CGNAT,
 * documentation, benchmarking, multicast and reserved space.
 */
const blocked = new BlockList();
const v4: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];
for (const [net, prefix] of v4) blocked.addSubnet(net, prefix, "ipv4");
const v6: [string, number][] = [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
  ["2001:db8::", 32], ["64:ff9b::", 96], ["2002::", 16], ["100::", 64], ["2001::", 32],
];
for (const [net, prefix] of v6) blocked.addSubnet(net, prefix, "ipv6");

/** Returns true only for globally routable public unicast addresses. */
export function isPublicIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return !blocked.check(ip, "ipv4");
  if (family === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^(?:0{0,4}:){0,5}(?:ffff:)(\d+\.\d+\.\d+\.\d+)$/) ?? lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicIp(mapped[1]);
    return !blocked.check(ip, "ipv6");
  }
  return false;
}

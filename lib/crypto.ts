/**
 * SHA-256 hashing utility for anonymous reporter identification.
 * Uses the built-in Web Crypto API — no external dependencies.
 */

export async function generateReporterHash(
  deviceId: string,
): Promise<string> {
  const salt =
    process.env.NEXT_PUBLIC_HASH_SALT ?? "speakup-payatas-default-salt";
  const data = new TextEncoder().encode(`${deviceId}:${salt}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";

  let deviceId = localStorage.getItem("speakup_device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("speakup_device_id", deviceId);
  }
  return deviceId;
}

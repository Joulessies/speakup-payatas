import fs from "fs";
import path from "path";

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf8");
  env.split("\n").forEach((line) => {
    const [k, ...v] = line.trim().split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  });
}

import { getSmsBackend, isMockSmsDelivery } from "../lib/sms-provider";
import { sendSemaphoreOtpSms } from "../lib/semaphore";

async function main() {
  const targetPhone = process.argv[2];
  if (!targetPhone) {
    console.error("Usage: npx tsx scripts/test-real-sms.ts <PH_PHONE_NUMBER>");
    console.error("Example: npx tsx scripts/test-real-sms.ts 09171234567");
    process.exit(1);
  }

  const digits = targetPhone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) {
    console.error("Error: Please provide a valid 10-digit or 11-digit Philippine mobile number.");
    process.exit(1);
  }

  const backend = getSmsBackend();
  const isMock = isMockSmsDelivery();

  console.log(`[SMS Test] Backend: ${backend}`);
  console.log(`[SMS Test] Mode: ${isMock ? "MOCK (No real SMS sent)" : "REAL LIVE SMS"}`);
  console.log(`[SMS Test] Destination: +63 ${digits}`);

  if (isMock) {
    console.warn("\n⚠️ WARNING: Running in MOCK mode.");
    console.warn("To send real SMS, configure your provider in .env.local:");
    console.warn("For TextBee (Free Android Gateway):");
    console.warn("  SMS_PROVIDER=textbee");
    console.warn("  TEXTBEE_API_KEY=your_key");
    console.warn("  TEXTBEE_DEVICE_ID=your_device_id\n");
    console.warn("For Semaphore:");
    console.warn("  SMS_PROVIDER=semaphore");
    console.warn("  SEMAPHORE_API_KEY=your_key\n");
  }

  const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`[SMS Test] Sending test OTP code: ${testOtp}...`);

  try {
    await sendSemaphoreOtpSms(digits, testOtp);
    if (!isMock) {
      console.log(`\n✅ SUCCESS: Real SMS dispatched successfully to +63 ${digits}! Check your phone.`);
    } else {
      console.log(`\nℹ️ Mock SMS logged to console.`);
    }
  } catch (err) {
    console.error("\n❌ FAILED TO SEND SMS:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();

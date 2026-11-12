import http from "k6/http";
import { check, sleep } from "k6";

/**
 * SpeakUp Payatas — k6 Load Testing Suite
 * Simulates concurrent resident submissions, category classifications, and transparency requests.
 *
 * Usage:
 *   k6 run scripts/k6/load-test.js
 *   k6 run -e BASE_URL=https://your-production-domain.com scripts/k6/load-test.js
 */

export const options = {
  stages: [
    { duration: "20s", target: 10 }, // Ramp-up to 10 virtual users
    { duration: "40s", target: 30 }, // Scale to 30 virtual users
    { duration: "30s", target: 30 }, // Stay at 30 virtual users
    { duration: "15s", target: 0 },  // Ramp-down to 0
  ],
  thresholds: {
    // 95% of all requests must complete within 600ms
    http_req_duration: ["p(95)<600"],
    // Error rate must remain under 1%
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const SAMPLE_REPORTS = [
  { text: "Napakalakas ng videoke kaninang madaling araw hindi kami makatulog", area: "Area A" },
  { text: "May sunog po sa may bandang Phase 3 malapit sa talipapa tulong!", area: "Phase 3" },
  { text: "Pumutok po ang tubo ng tubig sa tapat ng bahay bumabaha na sa kalsada", area: "Lupang Pangako" },
  { text: "Nanghihingi po ako ng tulong pinansyal para sa gamot ng nanay ko", area: "Area B" },
  { text: "Hindi pa nahahakot ang basura dito sa amin tatlong linggo na mabaho", area: "Kasunduan" },
  { text: "May nag-aaway sa kalsada may dalang patalim delikado", area: "Payatas Road" },
  { text: "Madilim po ang poste ng ilaw sa kanto namin pundi na ang bumbilya", area: "Group 13" },
  { text: "May asong gala na nanghahabol ng mga bata sa kalsada", area: "Litex" },
];

export default function () {
  // ── 1. Test Transparency & Public Analytics API ──
  const resTransparency = http.get(`${BASE_URL}/api/transparency`);
  check(resTransparency, {
    "transparency returns 200": (r) => r.status === 200,
    "transparency response time < 400ms": (r) => r.timings.duration < 400,
  });

  // ── 2. Test Random Forest AI Classification API ──
  const randomSample = SAMPLE_REPORTS[Math.floor(Math.random() * SAMPLE_REPORTS.length)];
  const classifyPayload = JSON.stringify({
    description: randomSample.text,
    text: randomSample.text,
    area: randomSample.area,
  });

  const classifyHeaders = {
    headers: { "Content-Type": "application/json" },
  };

  const resClassify = http.post(`${BASE_URL}/api/classify`, classifyPayload, classifyHeaders);
  check(resClassify, {
    "classify returns 200": (r) => r.status === 200,
    "classify returns category": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && typeof body.category === "string" && body.category.length > 0;
      } catch {
        return false;
      }
    },
    "classify returns urgency": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && typeof body.urgency === "string";
      } catch {
        return false;
      }
    },
    "classify returns confidence > 0": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && typeof body.confidence === "number" && body.confidence > 0;
      } catch {
        return false;
      }
    },
    "classify response time < 500ms": (r) => r.timings.duration < 500,
  });

  // ── 3. Test Public Summary API ──
  const resSummary = http.get(`${BASE_URL}/api/summary`);
  check(resSummary, {
    "summary returns 200": (r) => r.status === 200,
  });

  sleep(1);
}


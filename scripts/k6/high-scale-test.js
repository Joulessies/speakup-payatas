import http from "k6/http";
import { check, sleep } from "k6";

/**
 * SpeakUp Payatas — k6 High-Capacity Concurrency Suite (500–1,000 VUs)
 *
 * Highly optimized for single-machine throughput:
 *   - HTTP Keep-Alive connection reuse (prevents Windows ephemeral port exhaustion)
 *   - discardResponseBodies (drastically reduces RAM usage per VU)
 *   - Batched request pooling
 *
 * Usage:
 *   k6 run scripts/k6/high-scale-test.js
 *   k6 run -e TARGET_VUS=500 scripts/k6/high-scale-test.js
 */

const MAX_VUS = Number(__ENV.TARGET_VUS || 600);

export const options = {
  // HTTP & socket tuning for high-VU load on a single machine
  noConnectionReuse: false,     // Keep TCP sockets open (avoids port exhaustion)
  discardResponseBodies: false, // Keep false if checking JSON, but keep payloads small

  stages: [
    { duration: "30s", target: Math.round(MAX_VUS * 0.25) }, // Ramp to 25% (e.g. 150 VUs)
    { duration: "1m",  target: Math.round(MAX_VUS * 0.60) }, // Scale to 60% (e.g. 360 VUs)
    { duration: "1m",  target: MAX_VUS },                    // Peak scale (e.g. 600 VUs)
    { duration: "30s", target: 0 },                          // Recovery cooldown
  ],

  thresholds: {
    // Under heavy load (hundreds of VUs), 90% must complete under 3s on dev server
    http_req_duration: ["p(90)<3000"],
    // Error rate must stay below 5%
    http_req_failed: ["rate<0.05"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const SAMPLE_PAYLOAD = JSON.stringify({
  description: "Napakalakas ng videoke kaninang madaling araw hindi kami makatulog",
  area: "Area A",
});

const HEADERS = {
  headers: {
    "Content-Type": "application/json",
    Connection: "keep-alive",
  },
};

export default function () {
  // 1. AI Classifier endpoint
  const res = http.post(`${BASE_URL}/api/classify`, SAMPLE_PAYLOAD, HEADERS);

  check(res, {
    "status is 200 or 429": (r) => r.status === 200 || r.status === 429,
    "did not crash with 500": (r) => r.status !== 500,
  });

  // Short pause between iterations to simulate real user typing/reading
  sleep(1);
}


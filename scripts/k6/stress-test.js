import http from "k6/http";
import { check, sleep } from "k6";

/**
 * SpeakUp Payatas — k6 Stress & Concurrency Suite
 * Tests system limits under high concurrency (up to 120 VUs) to verify rate-limiting,
 * connection pooling, and server stability.
 *
 * Usage:
 *   k6 run scripts/k6/stress-test.js
 */

export const options = {
  stages: [
    { duration: "30s", target: 30 },  // Normal load
    { duration: "1m",  target: 80 },  // Heavy load
    { duration: "1m",  target: 120 }, // Peak stress / DoS resilience boundary
    { duration: "30s", target: 0 },   // Recovery
  ],
  thresholds: {
    // Under heavy load, 90% must complete under 1.2s
    http_req_duration: ["p(90)<1200"],
    // Error rate must stay under 5%
    http_req_failed: ["rate<0.05"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const payload = JSON.stringify({
    description: "May sunog po sa may bandang Phase 3 malapit sa talipapa tulong!",
    text: "May sunog po sa may bandang Phase 3 malapit sa talipapa tulong!",
    area: "Phase 3",
  });

  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const res = http.post(`${BASE_URL}/api/classify`, payload, params);

  check(res, {
    "status is 200 or 429 (rate-limited)": (r) => r.status === 200 || r.status === 429,
    "did not crash with 500": (r) => r.status !== 500,
  });

  sleep(0.5);
}


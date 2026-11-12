import http from "k6/http";
import { check, sleep } from "k6";

/**
 * SpeakUp Payatas — 200,000 Resident Population Surge Simulation
 *
 * Uses k6's Arrival-Rate Engine to model population traffic without exhausting
 * Windows OS TCP ports:
 *   - Constant/Ramping request injection
 *   - HTTP Keep-Alive connection pooling
 *   - Models citizen report submissions & public dashboard queries
 *
 * Usage:
 *   npm run test:200k
 *   k6 run scripts/k6/200k-users-simulation.js
 */

export const options = {
  scenarios: {
    payatas_population_traffic: {
      executor: "ramping-arrival-rate",
      startRate: 30,         // Starts at 30 new citizen visits per second
      timeUnit: "1s",
      preAllocatedVUs: 100,  // Pre-allocated virtual workers pool
      maxVUs: 800,           // Can scale up to 800 workers to handle peak surges
      stages: [
        { target: 100, duration: "30s" }, // Morning surge: 100 citizens/sec
        { target: 250, duration: "1m" },  // Heavy event: 250 citizens/sec (~15,000/min)
        { target: 400, duration: "1m" },  // Peak disaster reporting: 400 citizens/sec (~24,000/min)
        { target: 0,   duration: "30s" }, // Cooldown to 0
      ],
    },
  },
  thresholds: {
    // Under heavy population load, 90% must complete under 3.5s on dev server
    http_req_duration: ["p(90)<3500"],
    // Error rate must stay below 5%
    http_req_failed: ["rate<0.05"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const SAMPLE_REPORTS = [
  "Napakalakas ng videoke kaninang madaling araw hindi kami makatulog",
  "May sunog po sa may bandang Phase 3 malapit sa talipapa tulong!",
  "Pumutok po ang tubo ng tubig sa tapat ng bahay bumabaha na sa kalsada",
  "Nanghihingi po ako ng tulong pinansyal para sa gamot ng nanay ko",
  "Hindi pa nahahakot ang basura dito sa amin tatlong linggo na mabaho",
  "May nag-aaway sa kalsada may dalang patalim delikado",
  "Madilim po ang poste ng ilaw sa kanto namin pundi na ang bumbilya",
  "May asong gala na nanghahabol ng mga bata sa kalsada",
];

const HEADERS = {
  headers: {
    "Content-Type": "application/json",
    Connection: "keep-alive",
  },
};

export default function () {
  // Alternate between AI incident reporting (70%) and transparency viewing (30%)
  if (Math.random() < 0.7) {
    const text = SAMPLE_REPORTS[Math.floor(Math.random() * SAMPLE_REPORTS.length)];
    const payload = JSON.stringify({
      description: text,
      text: text,
      area: "Area A",
    });

    const res = http.post(`${BASE_URL}/api/classify`, payload, HEADERS);
    check(res, {
      "classify status 200": (r) => r.status === 200,
      "classify has category": (r) => {
        try {
          return Boolean(JSON.parse(r.body).category);
        } catch {
          return false;
        }
      },
    });
  } else {
    const res = http.get(`${BASE_URL}/api/transparency`, HEADERS);
    check(res, {
      "transparency status 200": (r) => r.status === 200,
    });
  }

  sleep(0.5);
}

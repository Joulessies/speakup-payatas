import posthog from "posthog-js";

export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window !== "undefined" && posthog.__loaded) {
    posthog.capture(eventName, properties);
  }
}

export function trackSecurityEvent(
  action: "rate_limit_hit" | "suspicious_payload" | "auth_failure" | "unauthorized_route_attempt",
  details?: Record<string, unknown>
) {
  if (typeof window !== "undefined" && posthog.__loaded) {
    posthog.capture(`security_${action}`, {
      timestamp: new Date().toISOString(),
      ...details,
    });
  }
}

export function identifyUser(userId: string, role?: string) {
  if (typeof window !== "undefined" && posthog.__loaded) {
    posthog.identify(userId, {
      role: role || "resident",
    });
  }
}

export function resetUser() {
  if (typeof window !== "undefined" && posthog.__loaded) {
    posthog.reset();
  }
}

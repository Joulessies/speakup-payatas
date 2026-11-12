import { SeverityNumber } from "@opentelemetry/api-logs";
import { after } from "next/server";
import { posthogLogger, posthogLoggerProvider } from "@/instrumentation";

type LogAttributes = Record<string, string | number | boolean>;

export function emitPosthogLog(
  body: string,
  attributes: LogAttributes,
  severityNumber: SeverityNumber = SeverityNumber.INFO,
): void {
  const loggerProvider = posthogLoggerProvider;
  if (!posthogLogger || !loggerProvider) return;

  posthogLogger.emit({ body, attributes, severityNumber });

  after(() => {
    void loggerProvider.forceFlush().catch(() => {});
  });
}

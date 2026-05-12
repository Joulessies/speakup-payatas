"use client";

export type MapsUnavailableReason = "missing-key" | "auth-failed" | "load-error";

const DEFAULT_MESSAGES: Record<MapsUnavailableReason, string> = {
    "missing-key": "Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to load Google Maps.",
    "auth-failed": "Google Maps rejected this site.",
    "load-error": "Could not load Google Maps. Check your connection and try again.",
};

// Per-code remediation hints for the most common failure modes.
const ERROR_CODE_HINTS: Record<string, string> = {
    ApiNotActivatedMapError:
        "Enable the Maps JavaScript API for this project in Google Cloud Console.",
    ApiTargetBlockedMapError:
        "Add Maps JavaScript API to this key's API restrictions in Google Cloud Console.",
    BillingNotEnabledMapError:
        "Enable billing on the Google Cloud project that owns this API key.",
    ClientBillingNotEnabledMapError:
        "Enable billing on the Google Cloud project that owns this client ID.",
    DeletedApiProjectMapError:
        "The Cloud project for this API key was deleted. Create a new project and a new key.",
    ExpiredKeyMapError:
        "This API key has expired. Generate a new key in Google Cloud Console.",
    InvalidKeyMapError:
        "This API key isn't recognized. Double-check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.",
    MissingKeyMapError:
        "No API key was sent. Make sure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set at build time.",
    OverQuotaMapError:
        "Daily quota exceeded. Raise the cap in Google Cloud Console or wait for the daily reset.",
    ProjectDeniedMapError:
        "The Cloud project denied the request. Open Cloud Console for details.",
    RefererDeniedMapError:
        "Application blocked for Terms of Service non-compliance. Appeal via Google's support form.",
    RefererNotAllowedMapError:
        "Add this URL to the API key's HTTP referrer allowlist in Google Cloud Console.",
    TOSViolationMapError:
        "Application blocked for Terms of Service non-compliance. Appeal via Google's support form.",
    UnauthorizedURLForClientIdMapError:
        "Register this URL under the Premium Plan / Maps for Work client ID.",
};

const TROUBLESHOOTING_BASE =
    "https://developers.google.com/maps/documentation/javascript/error-messages";

function anchorForCode(code: string | null): string {
    if (!code)
        return TROUBLESHOOTING_BASE;
    return `${TROUBLESHOOTING_BASE}#${code.toLowerCase().replace(/maperror$/, "-map-error")}`;
}

interface MapsMissingKeyProps {
    label?: string;
    reason?: MapsUnavailableReason;
    errorCode?: string | null;
}

export default function MapsMissingKey({
    label,
    reason = "missing-key",
    errorCode = null,
}: MapsMissingKeyProps) {
    const baseMessage = label ?? DEFAULT_MESSAGES[reason];
    const hint = errorCode ? ERROR_CODE_HINTS[errorCode] : undefined;
    return (
        <div className="flex h-full w-full items-center justify-center bg-muted/40 px-4 text-center">
            <div className="max-w-sm space-y-2">
                <p className="text-sm text-muted-foreground">{baseMessage}</p>
                {errorCode && (
                    <p className="text-xs font-mono text-muted-foreground/80">{errorCode}</p>
                )}
                {hint && <p className="text-xs text-muted-foreground/90">{hint}</p>}
                {reason !== "missing-key" && (
                    <a
                        href={anchorForCode(errorCode)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-xs text-indigo-500 underline underline-offset-2 hover:text-indigo-400"
                    >
                        Troubleshooting guide
                    </a>
                )}
            </div>
        </div>
    );
}

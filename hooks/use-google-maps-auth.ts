"use client";

import { useSyncExternalStore } from "react";

// Google Maps invokes `window.gm_authFailure` for any auth-side failure:
// invalid/expired key, billing disabled, referer not allowed, quota exceeded,
// Maps JS API not enabled, etc. Without a handler the API shows a darkened
// watermarked map ("for development purposes only") and writes the specific
// error code to console.error. We also sniff console.error to surface that
// code through the UI so users don't have to open DevTools.
// Docs: https://developers.google.com/maps/documentation/javascript/events#auth-errors

declare global {
    interface Window {
        gm_authFailure?: () => void;
    }
}

export interface GoogleMapsAuthState {
    failed: boolean;
    errorCode: string | null;
}

let state: GoogleMapsAuthState = { failed: false, errorCode: null };
const listeners = new Set<() => void>();
let installed = false;

const MAPS_ERROR_RE = /Google Maps JavaScript API (?:error|warning): ([A-Za-z]+)/;
// Codes that mean the API is actually broken on the page (vs. a soft warning).
const FATAL_CODES = new Set([
    "ApiNotActivatedMapError",
    "ApiTargetBlockedMapError",
    "BillingNotEnabledMapError",
    "ClientBillingNotEnabledMapError",
    "DeletedApiProjectMapError",
    "ExpiredKeyMapError",
    "InvalidAppCheckTokenMapError",
    "InvalidClientIdMapError",
    "InvalidKeyMapError",
    "MalformedCredentialsMapError",
    "MissingKeyMapError",
    "NotLoadingAPIFromGoogleMapsError",
    "OverQuotaMapError",
    "ProjectDeniedMapError",
    "RefererDeniedMapError",
    "RefererNotAllowedMapError",
    "TOSViolationMapError",
    "UnauthorizedURLForClientIdMapError",
    "UrlAuthenticationCommonError",
]);

function notify() {
    for (const listener of listeners)
        listener();
}

function setState(next: Partial<GoogleMapsAuthState>) {
    state = { ...state, ...next };
    notify();
}

function install() {
    if (installed || typeof window === "undefined")
        return;
    installed = true;

    const priorAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
        // gm_authFailure carries no args; the code came (or will come) via console.error.
        setState({ failed: true });
        try {
            priorAuthFailure?.();
        }
        catch {
            // Swallow third-party handler errors so our state still propagates.
        }
    };

    const originalError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
        for (const arg of args) {
            if (typeof arg !== "string")
                continue;
            const match = arg.match(MAPS_ERROR_RE);
            if (!match)
                continue;
            const code = match[1];
            if (state.errorCode !== code) {
                const failed = state.failed || FATAL_CODES.has(code);
                setState({ failed, errorCode: code });
            }
            break;
        }
        originalError(...args);
    };
}

function subscribe(listener: () => void): () => void {
    install();
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getSnapshot(): GoogleMapsAuthState {
    return state;
}

const SERVER_STATE: GoogleMapsAuthState = { failed: false, errorCode: null };

function getServerSnapshot(): GoogleMapsAuthState {
    return SERVER_STATE;
}

/** Full auth/error state reported by Google Maps for the current page. */
export function useGoogleMapsAuthState(): GoogleMapsAuthState {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Convenience: true once Google Maps has reported any fatal auth/billing failure. */
export function useGoogleMapsAuthFailed(): boolean {
    return useGoogleMapsAuthState().failed;
}

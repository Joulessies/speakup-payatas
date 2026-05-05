import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

/** Next.js only inlines NEXT_PUBLIC_* when accessed with literal keys (not process.env[var]). */
function firebaseConfig() {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
    const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();
    if (!apiKey) {
        throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY for Firebase Phone Auth.");
    }
    if (!authDomain) {
        throw new Error("Missing NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN for Firebase Phone Auth.");
    }
    if (!projectId) {
        throw new Error("Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID for Firebase Phone Auth.");
    }
    if (!appId) {
        throw new Error("Missing NEXT_PUBLIC_FIREBASE_APP_ID for Firebase Phone Auth.");
    }
    return { apiKey, authDomain, projectId, appId };
}

export function getFirebaseClientAuth() {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig());
    return getAuth(app);
}

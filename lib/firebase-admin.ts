import { App, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing ${name} for Firebase Admin.`);
    }
    return value;
}

function resolvePrivateKey(raw: string): string {
    return raw.replace(/\\n/g, "\n");
}

function getFirebaseAdminApp(): App {
    if (getApps().length > 0) {
        return getApp();
    }

    const projectId = requiredEnv("FIREBASE_PROJECT_ID");
    const clientEmail = requiredEnv("FIREBASE_CLIENT_EMAIL");
    const privateKey = resolvePrivateKey(requiredEnv("FIREBASE_PRIVATE_KEY"));

    return initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey,
        }),
        projectId,
    });
}

export function getFirebaseAdminAuth() {
    return getAuth(getFirebaseAdminApp());
}

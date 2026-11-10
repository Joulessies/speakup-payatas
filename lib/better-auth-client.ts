"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : process.env.NODE_ENV === "production" ? "https://speakupayatas.com" : "http://localhost:3000"),
    plugins: [
        adminClient(),
        twoFactorClient(),
    ],
});

export const {
    signIn,
    signUp,
    signOut,
    useSession,
    changePassword,
    twoFactor,
} = authClient;

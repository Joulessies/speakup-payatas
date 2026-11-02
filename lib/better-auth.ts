import { betterAuth } from "better-auth";
import { admin, twoFactor } from "better-auth/plugins";
import { Pool } from "pg";

function getDatabasePool() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        return new Pool({
            connectionString: "postgresql://postgres:postgres@localhost:5432/postgres",
        });
    }
    return new Pool({
        connectionString,
        ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
    });
}

export const auth = betterAuth({
    database: getDatabasePool(),
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        maxPasswordLength: 128,
        autoSignIn: true,
    },
    rateLimit: {
        enabled: true,
        window: 60, 
        max: 10,
        customRules: {
            "/sign-in/email": {
                window: 60,
                max: 5,
            },
            "/sign-up/email": {
                window: 60,
                max: 5,
            },
        },
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, 
        updateAge: 60 * 60 * 24, 
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, 
        },
    },
    plugins: [
        admin({
            defaultRole: "user",
            adminRoles: ["admin"],
        }),
        twoFactor({
            issuer: "SpeakUp Payatas",
        }),
    ],
    advanced: {
        useSecureCookies: process.env.NODE_ENV === "production",
    },
    secret: process.env.BETTER_AUTH_SECRET || "fallback-change-in-production-at-least-32-chars-long",
    baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

export type Session = typeof auth.$Infer.Session;

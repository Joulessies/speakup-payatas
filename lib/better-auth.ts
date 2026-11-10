import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { Pool } from "pg";

function databasePool(connectionString: string) {
    // Port 6543 is Supabase's transaction pooler. Better Auth uses prepared
    // statements, which that pooler rejects, so use the session pooler on 5432.
    const url = connectionString.replace(
        /(pooler\.supabase\.com:)6543\b/,
        "$15432",
    );
    const local = url.includes("localhost") || url.includes("127.0.0.1");
    return new Pool({
        connectionString: url,
        ssl: local ? false : { rejectUnauthorized: false },
    });
}

const databaseUrl = process.env.DATABASE_URL?.trim();

export const auth = databaseUrl
    ? betterAuth({
        database: databasePool(databaseUrl),
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
        trustedOrigins: ["http://localhost:3000", "https://speakupayatas.com"],
        plugins: [
            admin({
                defaultRole: "user",
                adminRoles: ["admin"],
            }),
            twoFactor({
                issuer: "SpeakUp Payatas",
            }),
            dash(),
            // Must stay last so Next.js actually writes the session cookie.
            nextCookies(),
        ],
        advanced: {
            useSecureCookies: process.env.NODE_ENV === "production",
        },
        secret: process.env.BETTER_AUTH_SECRET || "fallback-change-in-production-at-least-32-chars-long",
        baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === "production" ? "https://speakupayatas.com" : "http://localhost:3000"),
    })
    : null;

export type Session = NonNullable<typeof auth> extends { $Infer: { Session: infer S } } ? S : never;

import withSerwist from "@serwist/next";
import type { NextConfig } from "next";

const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://maps.googleapis.com https://*.posthog.com https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co https://*.posthog.com https://maps.googleapis.com https://*.huggingface.co https://accounts.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
    poweredByHeader: false,
    turbopack: {
        root: __dirname,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "Content-Security-Policy", value: cspHeader },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
                    { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
                    { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
                ],
            },
        ];
    },
};
export default withSerwist({
    swSrc: "app/sw.ts",
    swDest: "public/sw.js",
    disable: process.env.NODE_ENV === "development",
})(nextConfig);

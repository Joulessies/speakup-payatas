import withSerwist from "@serwist/next";
import type { NextConfig } from "next";
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
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
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

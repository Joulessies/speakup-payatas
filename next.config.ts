import withSerwist from "@serwist/next";
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
    turbopack: {
        root: __dirname,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
};
export default withSerwist({
    swSrc: "app/sw.ts",
    swDest: "public/sw.js",
    disable: process.env.NODE_ENV === "development",
})(nextConfig);

import { auth } from "@/lib/better-auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

const unavailable = () =>
    NextResponse.json(
        { error: "Better Auth is not connected. Set DATABASE_URL to the Supabase Postgres URI on port 5432." },
        { status: 503 },
    );

export const { GET, POST } = auth
    ? toNextJsHandler(auth.handler)
    : { GET: unavailable, POST: unavailable };

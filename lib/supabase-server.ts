import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdmin: SupabaseClient | null = null;

function getSupabaseUrl(): string | undefined {
    return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

/**
 * Service-role client for server-side API routes only.
 * Lazily created so importing route modules does not throw when env is missing.
 */
export function getSupabaseAdmin(): SupabaseClient {
    if (cachedAdmin) {
        return cachedAdmin;
    }
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
            "Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
        );
    }
    // Accept old JWT format (eyJ...) or new format (sb_secret_...)
    const isValidServiceKey = serviceRoleKey.startsWith("eyJ") || serviceRoleKey.startsWith("sb_secret_");
    if (!isValidServiceKey) {
        throw new Error(
            "Invalid SUPABASE_SERVICE_ROLE_KEY. Should start with 'eyJ' (legacy JWT) or 'sb_secret_' (new format). Ensure you're using the service_role key, not the anon/publishable key.",
        );
    }
    cachedAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
    return cachedAdmin;
}

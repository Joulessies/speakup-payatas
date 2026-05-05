import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedBrowser: SupabaseClient | null = null;


export function getSupabaseBrowser(): SupabaseClient {
    if (cachedBrowser) {
        return cachedBrowser;
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            "Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        );
    }
    cachedBrowser = createClient(supabaseUrl, supabaseAnonKey);
    return cachedBrowser;
}

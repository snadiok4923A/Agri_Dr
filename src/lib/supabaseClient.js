/**
 * supabaseClient.js — THE single Supabase client for the whole app.
 *
 * One client, one import site. Never create another client elsewhere —
 * Supabase keeps its session/observer state inside the client instance,
 * so a second client would silently fork the auth state.
 *
 * Credentials come from Vite env vars (.env — never committed):
 *   VITE_SUPABASE_URL        e.g. https://quietlempkeldflcutpg.supabase.co
 *   VITE_SUPABASE_ANON_KEY   the Publishable/anon key (safe for browsers)
 *
 * Only the PUBLIC anon/publishable key ever lives in frontend code.
 * The service_role / secret keys must NEVER appear here.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Fail loudly (and only in dev) when env vars are missing, instead of
 *  letting the app boot with a broken client that fails at first auth
 *  call with a confusing error. */
if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey === "YOUR_SUPABASE_PUBLISHABLE_KEY") {
    // eslint-disable-next-line no-console
    console.error(
        "[Krisiveda] Supabase is not configured. Add your real keys to .env:\n" +
        "  VITE_SUPABASE_URL=https://quietlempkeldflcutpg.supabase.co\n" +
        "  VITE_SUPABASE_ANON_KEY=<your Supabase Publishable key>\n" +
        "Then restart the dev server.",
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Session persistence in localStorage (survives refresh — spec §9)
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // picks up the Google OAuth ?code= return
    },
});

import { createClient } from "@supabase/supabase-js";

let adminClient;
let authClient;

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Brak NEXT_PUBLIC_SUPABASE_URL.");
  }
  return url;
}

export function getSupabaseAdmin() {
  if (!adminClient) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error("Brak SUPABASE_SERVICE_ROLE_KEY.");
    }

    adminClient = createClient(getSupabaseUrl(), serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClient;
}

export function getSupabaseAuthClient() {
  if (!authClient) {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      throw new Error("Brak NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    }

    authClient = createClient(getSupabaseUrl(), anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return authClient;
}

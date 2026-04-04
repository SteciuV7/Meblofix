import { ROLE } from "@/lib/constants";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/server/supabase-admin";

function getBearerToken(req) {
  const authorization = req.headers.authorization || req.headers.Authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

async function loadProfileByUserId(userId, email) {
  const supabase = getSupabaseAdmin();
  let { data, error } = await supabase
    .from("firmy")
    .select("*")
    .eq("firma_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data && email) {
    const fallback = await supabase
      .from("firmy")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (fallback.error) {
      throw fallback.error;
    }

    data = fallback.data;
  }

  if (!data) {
    throw new Error("Nie znaleziono profilu użytkownika.");
  }

  return data;
}

export async function requireApiUser(req, { adminOnly = false } = {}) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error("Brak autoryzacji.");
    error.statusCode = 401;
    throw error;
  }

  const authClient = getSupabaseAuthClient();
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);

  if (error || !user) {
    const authError = new Error("Sesja wygasła lub jest nieprawidłowa.");
    authError.statusCode = 401;
    throw authError;
  }

  const profile = await loadProfileByUserId(user.id, user.email);

  const actor = {
    ...user,
    firma_id: profile.firma_id,
    role: profile.rola || ROLE.USER,
    nazwa_firmy: profile.nazwa_firmy,
    profile,
  };

  if (adminOnly && actor.role !== ROLE.ADMIN) {
    const accessError = new Error("Brak uprawnień.");
    accessError.statusCode = 403;
    throw accessError;
  }

  return actor;
}

export function actorToLogPayload(actor) {
  return {
    actor_firma_id: actor?.firma_id || null,
    actor_email: actor?.email || null,
    actor_role: actor?.role || null,
  };
}

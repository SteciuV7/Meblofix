import { supabase } from "@/lib/supabase";

export async function loadCurrentProfile() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    return null;
  }

  let { data: profile, error: profileError } = await supabase
    .from("firmy")
    .select("*")
    .eq("firma_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    const fallback = await supabase
      .from("firmy")
      .select("*")
      .eq("email", user.email)
      .maybeSingle();

    if (fallback.error) {
      throw fallback.error;
    }

    profile = fallback.data;
  }

  if (!profile) {
    throw new Error("Nie znaleziono profilu użytkownika.");
  }

  return {
    ...user,
    firma_id: profile.firma_id,
    role: profile.rola,
    nazwa_firmy: profile.nazwa_firmy,
    profile,
  };
}

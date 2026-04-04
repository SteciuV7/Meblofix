import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { DEFAULT_OPERATIONAL_SETTINGS } from "@/lib/constants";

export async function getOperationalSettings({ required = false } = {}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ustawienia_operacyjne")
    .select("*")
    .eq("aktywny", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data && required) {
    throw new Error("Brak aktywnej konfiguracji operacyjnej.");
  }

  if (!data) {
    return null;
  }

  return {
    ...DEFAULT_OPERATIONAL_SETTINGS,
    ...data,
  };
}

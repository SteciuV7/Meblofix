import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { DEFAULT_OPERATIONAL_SETTINGS } from "@/lib/constants";
import {
  normalizePolishPhoneNumber,
  removePolishCharacters,
} from "@/lib/utils";

function withOperationalDefaults(settings) {
  if (!settings) {
    return null;
  }

  return {
    ...DEFAULT_OPERATIONAL_SETTINGS,
    ...settings,
  };
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseRequiredText(value, label) {
  const normalized = `${value ?? ""}`.trim();
  if (!normalized) {
    throw createHttpError(`${label} jest wymagane.`, 400);
  }

  return normalized;
}

function parseOptionalPhone(value) {
  const normalized = normalizePolishPhoneNumber(value || "");
  return normalized || null;
}

function parseSmsTemplate(value, fallback) {
  const normalized = removePolishCharacters(`${value ?? ""}`.trim());
  return normalized || fallback;
}

function parseDecimal(value, label, { min, max } = {}) {
  const normalized = `${value ?? ""}`.trim().replace(",", ".");
  if (!normalized) {
    throw createHttpError(`${label} jest wymagane.`, 400);
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw createHttpError(`${label} musi byc liczba.`, 400);
  }

  if (min != null && parsed < min) {
    throw createHttpError(`${label} nie moze byc mniejsze niz ${min}.`, 400);
  }

  if (max != null && parsed > max) {
    throw createHttpError(`${label} nie moze byc wieksze niz ${max}.`, 400);
  }

  return parsed;
}

function parsePositiveInteger(value, label, { min = 1, max = 1440 } = {}) {
  const normalized = `${value ?? ""}`.trim();
  if (!normalized) {
    throw createHttpError(`${label} jest wymagane.`, 400);
  }

  if (!/^-?\d+$/.test(normalized)) {
    throw createHttpError(`${label} musi byc liczba calkowita.`, 400);
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed)) {
    throw createHttpError(`${label} musi byc liczba calkowita.`, 400);
  }

  if (parsed < min) {
    throw createHttpError(`${label} nie moze byc mniejsze niz ${min}.`, 400);
  }

  if (parsed > max) {
    throw createHttpError(`${label} nie moze byc wieksze niz ${max}.`, 400);
  }

  return parsed;
}

export async function getOperationalSettings({ required = false, id = null } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("ustawienia_operacyjne").select("*");

  if (id) {
    query = query.eq("id", id);
  } else {
    query = query.eq("aktywny", true);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data && required) {
    throw createHttpError(
      id
        ? "Nie znaleziono konfiguracji operacyjnej."
        : "Brak aktywnej konfiguracji operacyjnej.",
      404
    );
  }

  return withOperationalDefaults(data);
}

export function normalizeOperationalSettingsPayload(payload = {}) {
  return {
    nazwa: parseRequiredText(payload.nazwa, "Nazwa konfiguracji"),
    adres_bazy: parseRequiredText(payload.adres_bazy, "Adres bazy"),
    lat: parseDecimal(payload.lat, "Szerokosc geograficzna", {
      min: -90,
      max: 90,
    }),
    lon: parseDecimal(payload.lon, "Dlugosc geograficzna", {
      min: -180,
      max: 180,
    }),
    domyslny_czas_obslugi_min: parsePositiveInteger(
      payload.domyslny_czas_obslugi_min,
      "Domyslny czas postoju",
      { min: 1, max: 1440 }
    ),
    szerokosc_okna_min: parsePositiveInteger(
      payload.szerokosc_okna_min,
      "Szerokosc okna czasowego",
      { min: 1, max: 1440 }
    ),
    sms_kontakt_telefon: parseOptionalPhone(payload.sms_kontakt_telefon),
    sms_szablon_potwierdzenia: parseSmsTemplate(
      payload.sms_szablon_potwierdzenia,
      DEFAULT_OPERATIONAL_SETTINGS.sms_szablon_potwierdzenia
    ),
    sms_szablon_startu_trasy: parseSmsTemplate(
      payload.sms_szablon_startu_trasy,
      DEFAULT_OPERATIONAL_SETTINGS.sms_szablon_startu_trasy
    ),
  };
}

export async function updateOperationalSettings(settingsId, payload = {}) {
  if (!settingsId) {
    throw createHttpError("Brak identyfikatora konfiguracji operacyjnej.", 400);
  }

  await getOperationalSettings({ id: settingsId, required: true });

  const supabase = getSupabaseAdmin();
  const changes = normalizeOperationalSettingsPayload(payload);

  const { data, error } = await supabase
    .from("ustawienia_operacyjne")
    .update(changes)
    .eq("id", settingsId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return withOperationalDefaults(data);
}

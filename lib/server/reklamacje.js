import { ROLE, REKLAMACJA_STATUS, STORAGE_BUCKET } from "@/lib/constants";
import { geocodeAddressServer } from "@/lib/server/google-maps";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import {
  formatPostalOnBlur,
  sanitizeAddress,
  sanitizeTown,
} from "@/lib/formValidation";
import { actorToLogPayload } from "@/lib/server/auth";
import { removePolishCharacters } from "@/lib/utils";

export async function createOperationalLog(entry) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("logi_operacyjne").insert(entry);
  if (error) {
    throw error;
  }
}

async function loadComplaintById(id) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reklamacje")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function ensureComplaintAccess(reklamacja, actor) {
  if (actor.role === ROLE.ADMIN) {
    return;
  }

  if (reklamacja.firma_id !== actor.firma_id) {
    const error = new Error("Brak dostępu do tej reklamacji.");
    error.statusCode = 403;
    throw error;
  }
}

export async function uploadBase64FileIfNeeded(file, folder) {
  if (!file?.content || !file?.fileName || !file?.contentType) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const cleanFileName = removePolishCharacters(file.fileName);
  const filePath = `${folder}/${Date.now()}-${cleanFileName}`;
  const buffer = Buffer.from(file.content, "base64");

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, buffer, {
      contentType: file.contentType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return filePath;
}

function sanitizePayload(payload = {}) {
  return {
    ...payload,
    kod_pocztowy: formatPostalOnBlur(payload.kod_pocztowy || "").trim(),
    miejscowosc: sanitizeTown(payload.miejscowosc || "").trim(),
    adres: sanitizeAddress(payload.adres || "").trim(),
  };
}

export async function createReklamacjaRecord({ payload, actor }) {
  const supabase = getSupabaseAdmin();
  const sanitized = sanitizePayload(payload);
  const fullAddress = `${sanitized.adres}, ${sanitized.miejscowosc}, ${sanitized.kod_pocztowy}`;
  const coords = await geocodeAddressServer(fullAddress);

  const insertPayload = {
    ...sanitized,
    firma_id:
      actor.role === ROLE.ADMIN && payload.firma_id
        ? payload.firma_id
        : actor.firma_id,
    nazwa_firmy:
      payload.nazwa_firmy || actor.nazwa_firmy || payload.profile?.nazwa_firmy,
    status: REKLAMACJA_STATUS.NEW,
    realizacja_do: payload.realizacja_do,
    data_zakonczenia: null,
    pozostaly_czas: payload.pozostaly_czas,
    zalacznik_pdf: payload.zalacznik_pdf || null,
    zalacznik_zdjecia: payload.zalacznik_zdjecia || [],
    nieprzeczytane_dla_uzytkownika: true,
    lat: coords.lat,
    lon: coords.lon,
  };

  const { data, error } = await supabase
    .from("reklamacje")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await createOperationalLog({
    entity_type: "reklamacja",
    entity_id: data.id,
    reklamacja_id: data.id,
    action: "reklamacja_created",
    before_state: null,
    after_state: data,
    metadata: { source: "api" },
    ...actorToLogPayload(actor),
  });

  return data;
}

export async function getReklamacjaDetail({ reklamacjaId, actor }) {
  const supabase = getSupabaseAdmin();
  const reklamacja = await loadComplaintById(reklamacjaId);
  ensureComplaintAccess(reklamacja, actor);

  const { data: routeStops, error: stopError } = await supabase
    .from("trasy_punkty")
    .select("*, trasy(*)")
    .eq("reklamacja_id", reklamacjaId)
    .order("created_at", { ascending: false });

  if (stopError) {
    throw stopError;
  }

  const { data: logs, error: logsError } = await supabase
    .from("logi_operacyjne")
    .select("*")
    .eq("reklamacja_id", reklamacjaId)
    .order("created_at", { ascending: false });

  if (logsError) {
    throw logsError;
  }

  return {
    reklamacja,
    routeStop: routeStops?.[0] || null,
    routeHistory: routeStops || [],
    logs: logs || [],
  };
}

export async function updateReklamacjaRecord({
  reklamacja,
  payload,
  actor,
  nextStatus,
  action = "reklamacja_updated",
}) {
  const supabase = getSupabaseAdmin();
  const sanitized = sanitizePayload({
    ...reklamacja,
    ...payload,
  });
  const addressChanged =
    sanitized.adres !== reklamacja.adres ||
    sanitized.miejscowosc !== reklamacja.miejscowosc ||
    sanitized.kod_pocztowy !== reklamacja.kod_pocztowy;

  let coords = null;
  if (addressChanged) {
    const fullAddress = `${sanitized.adres}, ${sanitized.miejscowosc}, ${sanitized.kod_pocztowy}`;
    coords = await geocodeAddressServer(fullAddress);
  }

  const updatePayload = {
    ...payload,
    ...sanitized,
    status: nextStatus || payload.status || reklamacja.status,
    nieprzeczytane_dla_uzytkownika:
      actor.role === ROLE.ADMIN ? true : reklamacja.nieprzeczytane_dla_uzytkownika,
    ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
  };

  const { data, error } = await supabase
    .from("reklamacje")
    .update(updatePayload)
    .eq("id", reklamacja.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await createOperationalLog({
    entity_type: "reklamacja",
    entity_id: reklamacja.id,
    reklamacja_id: reklamacja.id,
    action,
    before_state: reklamacja,
    after_state: data,
    metadata: {
      actor_scope: actor.role === ROLE.ADMIN ? "admin" : "uzytkownik",
    },
    ...actorToLogPayload(actor),
  });

  return data;
}

export async function transitionComplaintStatus({
  reklamacjaId,
  actor,
  nextStatus,
  action,
  patch = {},
}) {
  const reklamacja = await loadComplaintById(reklamacjaId);
  ensureComplaintAccess(reklamacja, actor);

  return updateReklamacjaRecord({
    reklamacja,
    payload: patch,
    actor,
    nextStatus,
    action,
  });
}

export async function acknowledgeComplaint({ reklamacjaId, actor }) {
  const reklamacja = await loadComplaintById(reklamacjaId);
  ensureComplaintAccess(reklamacja, actor);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("acknowledge_reklamacja", {
    p_reklamacja_id: reklamacjaId,
    ...actorToLogPayload(actor),
  });

  if (error) {
    throw error;
  }

  return data;
}

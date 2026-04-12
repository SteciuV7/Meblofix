import {
  ACCEPTABLE_REKLAMACJA_STATUSES,
  ACTIVE_REKLAMACJA_STATUSES,
  MANUAL_REKLAMACJA_DISABLED_STATUSES,
  ROLE,
  REKLAMACJA_STATUS,
  STORAGE_BUCKET,
} from "@/lib/constants";
import {
  geocodeAddressServer,
  previewGeocodeAddressServer,
} from "@/lib/server/google-maps";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import {
  formatPostalOnBlur,
  sanitizeAddress,
  sanitizeTown,
} from "@/lib/formValidation";
import { actorToLogPayload, actorToRpcPayload } from "@/lib/server/auth";
import {
  normalizePolishPhoneNumber,
  removePolishCharacters,
} from "@/lib/utils";

const AUTO_ARCHIVE_COMPLETED_AFTER_DAYS = 28;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

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

async function loadActiveRouteStopsByComplaintIds(complaintIds = []) {
  const ids = [...new Set((complaintIds || []).filter(Boolean))];
  if (!ids.length) {
    return new Map();
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("trasy_punkty")
    .select(
      "id,reklamacja_id,status,trasa_id,trasy(id,numer,nazwa,status,data_trasy,planowany_start_at)"
    )
    .in("reklamacja_id", ids)
    .in("status", ["planned", "in_progress"]);

  if (error) {
    throw error;
  }

  return new Map(
    (data || []).map((item) => [
      item.reklamacja_id,
      {
        id: item.id,
        reklamacja_id: item.reklamacja_id,
        status: item.status,
        trasa_id: item.trasa_id,
        trasy: item.trasy || null,
      },
    ])
  );
}

function buildActiveRouteBlockError(activeRouteStop) {
  const routeLabel =
    activeRouteStop?.trasy?.nazwa ||
    activeRouteStop?.trasy?.numer ||
    "aktywnej trasy";
  const error = new Error(
    `Nie mozna recznie zmienic statusu reklamacji przypisanej do aktywnej trasy (${routeLabel}).`
  );
  error.statusCode = 409;
  return error;
}

function hasCompletionData(reklamacja) {
  return Boolean(
    reklamacja?.data_zakonczenia ||
      reklamacja?.opis_przebiegu?.trim() ||
      reklamacja?.zalacznik_pdf_zakonczenie ||
      (Array.isArray(reklamacja?.zalacznik_zakonczenie) &&
        reklamacja.zalacznik_zakonczenie.length)
  );
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
  return sanitizePayloadWithOptions(payload);
}

function stripTransientComplaintFields(payload = {}, actor = null) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const nextPayload = { ...payload };
  delete nextPayload.addressApprovalMode;

  if (actor?.role !== ROLE.ADMIN) {
    delete nextPayload.informacje;
    delete nextPayload.element_odebrany;
  }

  return nextPayload;
}

function normalizeCustomerName(value = "") {
  return String(value)
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .trim();
}

function sanitizePayloadWithOptions(payload = {}, options = {}) {
  const shouldValidateCustomer = options.requireCustomerData;
  const normalizedPayload = stripTransientComplaintFields(
    payload,
    options.actor || null
  );

  const sanitized = {
    ...normalizedPayload,
    nazwa_mebla:
      typeof normalizedPayload.nazwa_mebla === "string"
        ? normalizedPayload.nazwa_mebla.trim()
        : normalizedPayload.nazwa_mebla,
    kod_pocztowy: formatPostalOnBlur(normalizedPayload.kod_pocztowy || "").trim(),
    miejscowosc: sanitizeTown(normalizedPayload.miejscowosc || "").trim(),
    adres: sanitizeAddress(normalizedPayload.adres || "").trim(),
  };

  if (!shouldValidateCustomer) {
    return sanitized;
  }

  const imieKlienta = normalizeCustomerName(normalizedPayload.imie_klienta || "");
  const nazwiskoKlienta = normalizeCustomerName(
    normalizedPayload.nazwisko_klienta || ""
  );
  const telefonKlienta = normalizePolishPhoneNumber(
    normalizedPayload.telefon_klienta || ""
  );
  const nazwaMebla = `${sanitized.nazwa_mebla || ""}`.trim();

  if (!nazwaMebla) {
    throw validationError("Podaj nazwe mebla.");
  }

  if (!imieKlienta) {
    throw validationError("Podaj imie klienta.");
  }

  if (!nazwiskoKlienta) {
    throw validationError("Podaj nazwisko klienta.");
  }

  if (
    !/^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+(?:[ -][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+)*$/u.test(
      imieKlienta
    )
  ) {
    throw validationError(
      "Imie klienta moze zawierac tylko litery, spacje i myslnik."
    );
  }

  if (
    !/^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+(?:[ -][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+)*$/u.test(
      nazwiskoKlienta
    )
  ) {
    throw validationError(
      "Nazwisko klienta moze zawierac tylko litery, spacje i myslnik."
    );
  }

  if (!telefonKlienta) {
    throw validationError(
      "Podaj numer telefonu klienta w formacie 123456789, 123 456 789 lub +48 123 456 789."
    );
  }

  return {
    ...sanitized,
    nazwa_mebla: nazwaMebla,
    imie_klienta: imieKlienta,
    nazwisko_klienta: nazwiskoKlienta,
    telefon_klienta: telefonKlienta,
  };
}

function buildComplaintGeocodeInput(payload) {
  return {
    addressLine: payload.adres,
    town: payload.miejscowosc,
    postalCode: payload.kod_pocztowy,
  };
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 422;
  return error;
}

function conflictError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

export function normalizeComplaintClosePayload(payload = {}) {
  return {
    opis_przebiegu:
      typeof payload.opis_przebiegu === "string"
        ? payload.opis_przebiegu.trim()
        : "",
    zalacznik_pdf_zakonczenie:
      typeof payload.zalacznik_pdf_zakonczenie === "string" &&
      payload.zalacznik_pdf_zakonczenie.trim()
        ? payload.zalacznik_pdf_zakonczenie.trim()
        : null,
    zalacznik_zakonczenie: Array.isArray(payload.zalacznik_zakonczenie)
      ? payload.zalacznik_zakonczenie
          .filter((item) => typeof item === "string" && item.trim())
          .map((item) => item.trim())
      : [],
  };
}

export function validateComplaintClosePayload(payload = {}) {
  const normalized = normalizeComplaintClosePayload(payload);

  if (normalized.zalacznik_zakonczenie.length > 4) {
    throw validationError("Mozesz dodac maksymalnie 4 zdjecia zakonczenia.");
  }

  if (
    !normalized.opis_przebiegu &&
    !normalized.zalacznik_pdf_zakonczenie &&
    !normalized.zalacznik_zakonczenie.length
  ) {
    throw validationError(
      "Dodaj opis przebiegu albo przynajmniej jeden zalacznik zakonczenia."
    );
  }

  return normalized;
}

export function validateOptionalComplaintClosePayload(payload = {}) {
  const normalized = normalizeComplaintClosePayload(payload);

  if (normalized.zalacznik_zakonczenie.length > 4) {
    throw validationError("Mozesz dodac maksymalnie 4 zdjecia zakonczenia.");
  }

  return normalized;
}

export function normalizeComplaintInfoPatch(payload = {}) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Object.prototype.hasOwnProperty.call(payload, "informacje")
  ) {
    return {};
  }

  return {
    informacje:
      typeof payload.informacje === "string"
        ? payload.informacje.trim() || null
        : null,
  };
}

export function normalizeComplaintInfoValue(payload = {}) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Object.prototype.hasOwnProperty.call(payload, "informacje")
  ) {
    return undefined;
  }

  return typeof payload.informacje === "string" ? payload.informacje.trim() : "";
}

function normalizeWaitingDeliveryPayload(payload = {}) {
  return {
    ...normalizeComplaintInfoPatch(payload),
    ...validateOptionalComplaintClosePayload(payload),
  };
}

async function resolveComplaintGeocode(payload, options = {}) {
  try {
    return await geocodeAddressServer(
      buildComplaintGeocodeInput(payload),
      options
    );
  } catch (error) {
    if (options.optional && error.statusCode === 422) {
      console.warn("[geocode] Pomijam wspolrzedne dla reklamacji:", {
        adres: payload.adres,
        miejscowosc: payload.miejscowosc,
        kod_pocztowy: payload.kod_pocztowy,
        reason: error.message,
      });
      return null;
    }

    throw error;
  }
}

export async function previewComplaintGeocode({ payload }) {
  const sanitized = sanitizePayload(payload);

  return {
    requestedAddress: buildComplaintGeocodeInput(sanitized),
    geocode: await previewGeocodeAddressServer(
      buildComplaintGeocodeInput(sanitized)
    ),
  };
}

export async function createReklamacjaRecord({
  payload,
  actor,
  addressApprovalMode = "exact",
}) {
  const supabase = getSupabaseAdmin();
  const sanitized = sanitizePayloadWithOptions(payload, {
    requireCustomerData: true,
    actor,
  });
  const geocode = await resolveComplaintGeocode(sanitized, {
    allowApproximate: addressApprovalMode === "approximate",
  });

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
    informacje:
      actor.role === ROLE.ADMIN && typeof sanitized.informacje === "string"
        ? sanitized.informacje.trim() || null
        : null,
    element_odebrany:
      actor.role === ROLE.ADMIN ? Boolean(sanitized.element_odebrany) : false,
    nieprzeczytane_dla_uzytkownika: true,
    lat: geocode.lat,
    lon: geocode.lon,
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

export async function getComplaintActiveRouteStop(reklamacjaId) {
  const activeRouteStops = await loadActiveRouteStopsByComplaintIds([reklamacjaId]);
  return activeRouteStops.get(reklamacjaId) || null;
}

export async function ensureComplaintManualStatusChangeAllowed({
  reklamacjaId,
  activeRouteStop,
}) {
  const resolvedActiveRouteStop =
    activeRouteStop === undefined
      ? await getComplaintActiveRouteStop(reklamacjaId)
      : activeRouteStop;

  if (resolvedActiveRouteStop) {
    throw buildActiveRouteBlockError(resolvedActiveRouteStop);
  }

  return null;
}

export async function archiveOldCompletedComplaints({ actor }) {
  if (actor?.role !== ROLE.ADMIN) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const thresholdDate = new Date(
    Date.now() - AUTO_ARCHIVE_COMPLETED_AFTER_DAYS * DAY_IN_MS
  ).toISOString();

  const { data: oldCompletedComplaints, error: selectError } = await supabase
    .from("reklamacje")
    .select("*")
    .eq("status", REKLAMACJA_STATUS.DONE)
    .not("data_zakonczenia", "is", null)
    .lte("data_zakonczenia", thresholdDate);

  if (selectError) {
    throw selectError;
  }

  if (!oldCompletedComplaints?.length) {
    return [];
  }

  const complaintIds = oldCompletedComplaints.map((complaint) => complaint.id);
  const beforeStateById = new Map(
    oldCompletedComplaints.map((complaint) => [complaint.id, complaint])
  );

  const { data: archivedComplaints, error: updateError } = await supabase
    .from("reklamacje")
    .update({ status: REKLAMACJA_STATUS.ARCHIVE })
    .in("id", complaintIds)
    .eq("status", REKLAMACJA_STATUS.DONE)
    .not("data_zakonczenia", "is", null)
    .lte("data_zakonczenia", thresholdDate)
    .select("*");

  if (updateError) {
    throw updateError;
  }

  for (const archivedComplaint of archivedComplaints || []) {
    await createOperationalLog({
      entity_type: "reklamacja",
      entity_id: archivedComplaint.id,
      reklamacja_id: archivedComplaint.id,
      action: "reklamacja_archived_auto",
      before_state: beforeStateById.get(archivedComplaint.id) || null,
      after_state: archivedComplaint,
      metadata: {
        reason: "completed_older_than_28_days",
        threshold_days: AUTO_ARCHIVE_COMPLETED_AFTER_DAYS,
        threshold_date: thresholdDate,
      },
      ...actorToLogPayload(actor),
    });
  }

  return archivedComplaints || [];
}

export async function listReklamacjeRecords({ actor }) {
  await archiveOldCompletedComplaints({ actor });

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("reklamacje")
    .select("*")
    .neq("status", REKLAMACJA_STATUS.ARCHIVE)
    .order("data_zgloszenia", { ascending: false });

  if (actor.role !== ROLE.ADMIN) {
    query = query.eq("firma_id", actor.firma_id);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const reklamacje = data || [];
  const activeRouteStops = await loadActiveRouteStopsByComplaintIds(
    reklamacje.map((item) => item.id)
  );

  return reklamacje.map((reklamacja) => ({
    ...reklamacja,
    activeRouteStop: activeRouteStops.get(reklamacja.id) || null,
  }));
}

export async function listComplaintMapRecords({
  actor,
  status = "",
  firmaId = "",
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("reklamacje")
    .select("*")
    .in("status", ACTIVE_REKLAMACJA_STATUSES)
    .not("lat", "is", null)
    .not("lon", "is", null)
    .order("realizacja_do", { ascending: true })
    .order("data_zgloszenia", { ascending: false });

  if (actor.role !== ROLE.ADMIN) {
    query = query.eq("firma_id", actor.firma_id);
  } else {
    if (status) {
      if (!ACTIVE_REKLAMACJA_STATUSES.includes(status)) {
        throw validationError("Wybrany status mapy jest nieprawidlowy.");
      }
      query = query.eq("status", status);
    }

    if (firmaId) {
      query = query.eq("firma_id", firmaId);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data || [];
}

export async function listComplaintMapCompanies({ actor }) {
  if (actor.role !== ROLE.ADMIN) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reklamacje")
    .select("firma_id,nazwa_firmy")
    .in("status", ACTIVE_REKLAMACJA_STATUSES)
    .not("lat", "is", null)
    .not("lon", "is", null)
    .order("nazwa_firmy", { ascending: true });

  if (error) {
    throw error;
  }

  const companies = new Map();

  (data || []).forEach((item) => {
    if (!item?.firma_id || companies.has(item.firma_id)) {
      return;
    }

    companies.set(item.firma_id, {
      firma_id: item.firma_id,
      nazwa_firmy: item.nazwa_firmy || "Bez nazwy firmy",
    });
  });

  return [...companies.values()];
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

  const activeRouteStop = await getComplaintActiveRouteStop(reklamacjaId);

  return {
    reklamacja,
    activeRouteStop,
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
  requireCustomerDataValidation = false,
}) {
  const supabase = getSupabaseAdmin();
  const normalizedPayload = stripTransientComplaintFields(payload, actor);
  const sanitized = sanitizePayloadWithOptions(
    {
      ...reklamacja,
      ...normalizedPayload,
    },
    {
      requireCustomerData: requireCustomerDataValidation,
      actor,
    }
  );
  const addressChanged =
    sanitized.adres !== reklamacja.adres ||
    sanitized.miejscowosc !== reklamacja.miejscowosc ||
    sanitized.kod_pocztowy !== reklamacja.kod_pocztowy;

  let coords = null;
  if (addressChanged) {
    coords = await resolveComplaintGeocode(sanitized, { optional: true });
  }

  const updatePayload = {
    ...normalizedPayload,
    ...sanitized,
    status: nextStatus || payload.status || reklamacja.status,
    nieprzeczytane_dla_uzytkownika:
      actor.role === ROLE.ADMIN ? true : reklamacja.nieprzeczytane_dla_uzytkownika,
    ...(addressChanged ? { lat: coords?.lat ?? null, lon: coords?.lon ?? null } : {}),
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
  requireCustomerDataValidation = false,
}) {
  const reklamacja = await loadComplaintById(reklamacjaId);
  ensureComplaintAccess(reklamacja, actor);

  return updateReklamacjaRecord({
    reklamacja,
    payload: patch,
    actor,
    nextStatus,
    action,
    requireCustomerDataValidation,
  });
}

export async function acceptComplaint({ reklamacjaId, actor, payload = {} }) {
  const reklamacja = await loadComplaintById(reklamacjaId);
  ensureComplaintAccess(reklamacja, actor);

  if (!ACCEPTABLE_REKLAMACJA_STATUSES.includes(reklamacja.status)) {
    throw conflictError(
      "Reklamacje mozna przyjac tylko ze statusu Zgloszone lub Zaktualizowano."
    );
  }

  await ensureComplaintManualStatusChangeAllowed({ reklamacjaId });

  const informacje =
    typeof payload.informacje === "string" ? payload.informacje.trim() : "";

  return updateReklamacjaRecord({
    reklamacja,
    payload: {
      informacje: informacje || null,
    },
    actor,
    nextStatus: REKLAMACJA_STATUS.IN_PROGRESS,
    action: "reklamacja_accepted",
  });
}

export async function setComplaintPickedUp({
  reklamacjaId,
  actor,
  elementOdebrany,
}) {
  const reklamacja = await loadComplaintById(reklamacjaId);
  ensureComplaintAccess(reklamacja, actor);

  const nextValue = Boolean(elementOdebrany);

  if (Boolean(reklamacja.element_odebrany) === nextValue) {
    return reklamacja;
  }

  return updateReklamacjaRecord({
    reklamacja,
    payload: {
      element_odebrany: nextValue,
    },
    actor,
    action: "reklamacja_element_odebrany_updated",
  });
}

export async function manuallyChangeComplaintStatus({
  reklamacjaId,
  actor,
  nextStatus,
  closePayload,
  waitingDeliveryPayload,
}) {
  const reklamacja = await loadComplaintById(reklamacjaId);
  ensureComplaintAccess(reklamacja, actor);

  if (
    !Object.values(REKLAMACJA_STATUS).includes(nextStatus) ||
    nextStatus === REKLAMACJA_STATUS.WAITING_INFO
  ) {
    throw validationError("Wybrany status reklamacji jest nieprawidlowy.");
  }

  if (MANUAL_REKLAMACJA_DISABLED_STATUSES.includes(nextStatus)) {
    throw validationError("Tego statusu nie mozna ustawic recznie.");
  }

  const activeRouteStop = await getComplaintActiveRouteStop(reklamacjaId);
  await ensureComplaintManualStatusChangeAllowed({
    reklamacjaId,
    activeRouteStop,
  });

  if (
    reklamacja.status === nextStatus &&
    nextStatus !== REKLAMACJA_STATUS.WAITING_DELIVERY
  ) {
    return reklamacja;
  }

  let patch = {};
  let action = "reklamacja_status_changed_manual";

  if (nextStatus === REKLAMACJA_STATUS.DONE) {
    patch = {
      ...normalizeComplaintInfoPatch(closePayload),
      ...validateComplaintClosePayload(closePayload),
      data_zakonczenia: new Date().toISOString(),
    };
    action = "reklamacja_closed_manual";
  } else if (nextStatus === REKLAMACJA_STATUS.WAITING_DELIVERY) {
    patch = {
      ...normalizeWaitingDeliveryPayload(waitingDeliveryPayload),
      data_zakonczenia: null,
    };
    action = "reklamacja_waiting_delivery";
  } else if (nextStatus === REKLAMACJA_STATUS.ARCHIVE) {
    action = "reklamacja_archived_manual";
  } else if (hasCompletionData(reklamacja)) {
    patch = {
      data_zakonczenia: null,
      opis_przebiegu: "",
      zalacznik_pdf_zakonczenie: null,
      zalacznik_zakonczenie: [],
    };
  }

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
    ...actorToRpcPayload(actor),
  });

  if (error) {
    throw error;
  }

  return data;
}

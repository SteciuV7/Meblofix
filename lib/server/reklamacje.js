import {
  ACCEPTABLE_REKLAMACJA_STATUSES,
  ACTIVE_REKLAMACJA_STATUSES,
  MANUAL_REKLAMACJA_DISABLED_STATUSES,
  ROLE,
  REKLAMACJA_STATUS,
  SMS_CONFIRMATION_STATUS,
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
  formatDate,
  labelForOperationalAction,
  labelForStatus,
  normalizePolishPhoneNumber,
  removePolishCharacters,
} from "@/lib/utils";

const AUTO_ARCHIVE_COMPLETED_AFTER_DAYS = 28;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_FURNITURE_NAME_LENGTH = 15;

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

async function loadRouteStopBlockingAddressEdit(reklamacjaId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("trasy_punkty")
    .select("id,status,sms_potwierdzenie_status")
    .eq("reklamacja_id", reklamacjaId)
    .in("status", ["planned", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] || null;
}

async function ensureComplaintUserAddressEditAllowed({ reklamacjaId, actor }) {
  if (actor?.role !== ROLE.USER) {
    return null;
  }

  const blockingStop = await loadRouteStopBlockingAddressEdit(reklamacjaId);
  if (!blockingStop) {
    return null;
  }

  const smsStatus = blockingStop.sms_potwierdzenie_status || null;
  const isConfirmed = smsStatus === SMS_CONFIRMATION_STATUS.CONFIRMED;

  if (
    blockingStop.status === "in_progress" ||
    (blockingStop.status === "planned" && isConfirmed)
  ) {
    throw conflictError(
      "Nie mozna zmienic adresu reklamacji, gdy punkt jest w trasie lub zaplanowany i potwierdzony."
    );
  }

  return null;
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

const EMPTY_CHANGE_VALUE = "Brak";

const USER_VISIBLE_CHANGE_FIELDS = [
  {
    key: "nr_reklamacji",
    label: "Nr",
  },
  {
    key: "numer_faktury",
    label: "Numer reklamacji",
  },
  {
    key: "status",
    label: "Status",
    formatter: (value) => labelForStatus(value),
    shouldInclude: (before, after) =>
      before !== REKLAMACJA_STATUS.ARCHIVE &&
      after !== REKLAMACJA_STATUS.ARCHIVE,
  },
  {
    key: "realizacja_do",
    label: "Termin",
    formatter: formatDateChangeValue,
    comparable: normalizeDateComparableValue,
  },
  {
    key: "nazwa_mebla",
    label: "Nazwa mebla",
  },
  {
    key: "imie_klienta",
    label: "Imie klienta",
  },
  {
    key: "nazwisko_klienta",
    label: "Nazwisko klienta",
  },
  {
    key: "telefon_klienta",
    label: "Telefon klienta",
  },
  {
    key: "kod_pocztowy",
    label: "Kod pocztowy",
  },
  {
    key: "miejscowosc",
    label: "Miejscowosc",
  },
  {
    key: "adres",
    label: "Adres",
  },
  {
    key: "opis",
    label: "Opis",
  },
  {
    key: "informacje_od_zglaszajacego",
    label: "Informacje od zglaszajacego",
  },
  {
    key: "informacje",
    label: "Informacje od Meblofix",
  },
  {
    key: "element_odebrany",
    label: "Element odebrany",
    formatter: formatBooleanChangeValue,
  },
  {
    key: "data_zakonczenia",
    label: "Data zakonczenia",
    formatter: formatDateChangeValue,
    comparable: normalizeDateComparableValue,
  },
  {
    key: "opis_przebiegu",
    label: "Opis przebiegu",
  },
  {
    key: "zalacznik_pdf_zakonczenie",
    label: "PDF zakonczenia",
    formatter: formatAttachmentPresence,
  },
  {
    key: "zalacznik_zakonczenie",
    label: "Zdjecia zakonczenia",
    formatter: formatAttachmentList,
  },
];

const SMS_CONFIRMATION_CHANGE_ACTIONS = new Set([
  "route_sms_confirmation_confirmed",
  "route_sms_confirmation_rejected",
  "route_sms_confirmation_status_changed_manual",
]);

function hasOwnValue(source, key) {
  return Boolean(
    source && Object.prototype.hasOwnProperty.call(source, key)
  );
}

function normalizeChangeComparableValue(value) {
  if (value == null) {
    return "";
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value.filter(Boolean));
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return `${value}`;
}

function normalizeDateComparableValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? `${value}` : date.toISOString();
}

function isBlankChangeValue(value) {
  return (
    value == null ||
    (typeof value === "string" && !value.trim()) ||
    (Array.isArray(value) && value.length === 0)
  );
}

function formatBooleanChangeValue(value) {
  if (value == null) {
    return EMPTY_CHANGE_VALUE;
  }

  return value ? "Tak" : "Nie";
}

function formatDateChangeValue(value) {
  if (isBlankChangeValue(value)) {
    return EMPTY_CHANGE_VALUE;
  }

  return formatDate(value, true);
}

function formatAttachmentPresence(value) {
  return isBlankChangeValue(value) ? "Brak pliku" : "Dodano plik";
}

function formatAttachmentList(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return "Brak zdjec";
  }

  return `${value.length} zdj.`;
}

function formatDefaultChangeValue(value) {
  if (isBlankChangeValue(value)) {
    return EMPTY_CHANGE_VALUE;
  }

  if (Array.isArray(value)) {
    return formatAttachmentList(value);
  }

  return `${value}`;
}

function buildFieldDiff(field, beforeState, afterState) {
  if (!hasOwnValue(beforeState, field.key) && !hasOwnValue(afterState, field.key)) {
    return null;
  }

  const beforeValue = hasOwnValue(beforeState, field.key)
    ? beforeState[field.key]
    : null;
  const afterValue = hasOwnValue(afterState, field.key) ? afterState[field.key] : null;
  const comparable = field.comparable || normalizeChangeComparableValue;

  if (comparable(beforeValue) === comparable(afterValue)) {
    return null;
  }

  if (field.shouldInclude && !field.shouldInclude(beforeValue, afterValue)) {
    return null;
  }

  const formatter = field.formatter || formatDefaultChangeValue;

  return {
    fieldLabel: field.label,
    before: formatter(beforeValue),
    after: formatter(afterValue),
  };
}

function getSmsConfirmationStatusFromState(state) {
  return state?.sms_potwierdzenie_status || state?.smsConfirmationStatus || null;
}

function buildSmsConfirmationDiff(log) {
  if (!SMS_CONFIRMATION_CHANGE_ACTIONS.has(log?.action)) {
    return null;
  }

  const afterStatus =
    getSmsConfirmationStatusFromState(log.after_state) ||
    log.metadata?.next_status ||
    null;

  if (afterStatus !== SMS_CONFIRMATION_STATUS.CONFIRMED) {
    return null;
  }

  const beforeStatus =
    getSmsConfirmationStatusFromState(log.before_state) ||
    log.metadata?.previous_status ||
    SMS_CONFIRMATION_STATUS.NOT_SENT;

  return {
    fieldLabel: "Potwierdzenie SMS",
    before: labelForStatus(beforeStatus),
    after: labelForStatus(afterStatus),
  };
}

function buildLogChangeDiffs(log) {
  const beforeState = log?.before_state || null;
  const afterState = log?.after_state || null;
  const fieldDiffs = USER_VISIBLE_CHANGE_FIELDS.map((field) =>
    buildFieldDiff(field, beforeState, afterState)
  ).filter(Boolean);
  const smsDiff = buildSmsConfirmationDiff(log);

  return smsDiff ? [...fieldDiffs, smsDiff] : fieldDiffs;
}

function isUserAuthoredLog(log) {
  return log?.actor_role === ROLE.USER;
}

function formatLogSource(log) {
  if (log?.actor_role === ROLE.ADMIN) {
    return "Meblofix";
  }

  if (log?.actor_role === "public") {
    return "Link SMS klienta";
  }

  if (log?.actor_role === ROLE.USER) {
    return log.actor_email || "Uzytkownik";
  }

  return log?.actor_email || "System";
}

function buildPendingUserChanges({ reklamacja, logs = [] }) {
  const sortedLogs = [...(logs || [])].sort(
    (left, right) => new Date(left.created_at) - new Date(right.created_at)
  );
  const lastAcknowledgement = [...sortedLogs]
    .reverse()
    .find((log) => log.action === "reklamacja_acknowledged");
  const lastAcknowledgedAt = lastAcknowledgement?.created_at || null;

  if (!reklamacja?.nieprzeczytane_dla_uzytkownika) {
    return {
      hasChanges: false,
      lastAcknowledgedAt,
      events: [],
    };
  }

  const pendingLogs = sortedLogs.filter((log) => {
    if (log.action === "reklamacja_acknowledged" || isUserAuthoredLog(log)) {
      return false;
    }

    if (!lastAcknowledgedAt) {
      return true;
    }

    return new Date(log.created_at) > new Date(lastAcknowledgedAt);
  });

  const events = pendingLogs
    .map((log) => ({
      id: log.id,
      date: log.created_at,
      action: log.action,
      actionLabel: labelForOperationalAction(log.action),
      source: formatLogSource(log),
      changes: buildLogChangeDiffs(log),
    }))
    .filter((event) => event.changes.length > 0);

  return {
    hasChanges: events.length > 0,
    lastAcknowledgedAt,
    events,
  };
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

function normalizeText(value) {
  if (value == null) {
    return "";
  }

  if (typeof value !== "string") {
    return String(value);
  }

  return value.trim();
}

function validateFurnitureName(value) {
  const name = normalizeText(value);

  if (!name) {
    throw validationError("Podaj nazwe mebla.");
  }

  if (name.length > MAX_FURNITURE_NAME_LENGTH) {
    throw validationError(
      `Nazwa mebla moze miec maksymalnie ${MAX_FURNITURE_NAME_LENGTH} znakow.`
    );
  }

  return name;
}

function validateReporterInfo(value) {
  const info = normalizeText(value);

  if (!info) {
    throw validationError("Podaj informacje od zglaszajacego.");
  }

  return info;
}

function validateRealizacjaDo(value) {
  const raw = normalizeText(value);

  if (!raw) {
    throw validationError("Podaj termin realizacji.");
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw validationError("Termin realizacji jest nieprawidlowy.");
  }

  return raw;
}

function validateEditRequiredFields(payload) {
  validateFurnitureName(payload?.nazwa_mebla);
  validateReporterInfo(payload?.informacje_od_zglaszajacego);
  validateRealizacjaDo(payload?.realizacja_do);
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
  const nazwaMebla = validateFurnitureName(sanitized.nazwa_mebla);

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
  validateEditRequiredFields(sanitized);
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
    nieprzeczytane_dla_uzytkownika: actor.role === ROLE.ADMIN,
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
    pendingUserChanges: buildPendingUserChanges({
      reklamacja,
      logs: logs || [],
    }),
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

  if (action === "reklamacja_updated") {
    validateEditRequiredFields(sanitized);
  }

  const addressChanged =
    sanitized.adres !== reklamacja.adres ||
    sanitized.miejscowosc !== reklamacja.miejscowosc ||
    sanitized.kod_pocztowy !== reklamacja.kod_pocztowy;

  let coords = null;
  if (addressChanged) {
    await ensureComplaintUserAddressEditAllowed({
      reklamacjaId: reklamacja.id,
      actor,
    });

    coords = await resolveComplaintGeocode(sanitized, { optional: false });
  }

  let resolvedStatus = nextStatus || payload.status || reklamacja.status;
  if (
    !nextStatus &&
    !payload.status &&
    action === "reklamacja_updated" &&
    [
      REKLAMACJA_STATUS.NEW,
      REKLAMACJA_STATUS.IN_PROGRESS,
      REKLAMACJA_STATUS.WAITING_DELIVERY,
    ].includes(reklamacja.status)
  ) {
    resolvedStatus = REKLAMACJA_STATUS.UPDATED;
  }

  const updatePayload = {
    ...normalizedPayload,
    ...sanitized,
    status: resolvedStatus,
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

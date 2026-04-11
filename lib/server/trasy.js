import {
  DEFAULT_OPERATIONAL_SETTINGS,
  REKLAMACJA_STATUS,
  ROUTE_CANDIDATE_STATUSES,
  ROUTE_STATUS,
  ROUTE_STOP_FINAL_STATUSES,
  SMS_CONFIRMATION_STATUS,
} from "@/lib/constants";
import { actorToLogPayload, actorToRpcPayload } from "@/lib/server/auth";
import { computeRoutePlan } from "@/lib/server/google-maps";
import { getOperationalSettings } from "@/lib/server/operational";
import {
  createOperationalLog,
  validateComplaintClosePayload,
} from "@/lib/server/reklamacje";
import {
  buildRouteConfirmationLongUrl,
  createSmsConfirmationToken,
  formatRouteSmsWindow,
  hashSmsConfirmationToken,
  renderSmsTemplate,
  sendSmsMessage,
  shortenUrlWithIdzDo,
} from "@/lib/server/route-sms";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import {
  getComplaintCustomerName,
  getPhoneHref,
  normalizePolishPhoneNumber,
} from "@/lib/utils";

function createHttpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateRouteUndeliverPayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createHttpError("Nieprawidlowe dane zmiany statusu.", 422);
  }

  return {
    informacje:
      typeof payload.informacje === "string"
        ? payload.informacje.trim() || null
        : null,
  };
}

function getDefaultStopPostojMinutes(settings) {
  const parsed = Number(settings?.domyslny_czas_obslugi_min);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_OPERATIONAL_SETTINGS.domyslny_czas_obslugi_min;
}

function parseStopPostojMinutes(value, label = "Czas postoju") {
  const normalized = `${value ?? ""}`.trim();

  if (!normalized) {
    return null;
  }

  if (!/^-?\d+$/.test(normalized)) {
    throw createHttpError(`${label} musi byc liczba calkowita.`, 422);
  }

  const parsed = Number(normalized);

  if (!Number.isInteger(parsed)) {
    throw createHttpError(`${label} musi byc liczba calkowita.`, 422);
  }

  if (parsed < 1) {
    throw createHttpError(`${label} nie moze byc mniejszy niz 1.`, 422);
  }

  if (parsed > 1440) {
    throw createHttpError(`${label} nie moze byc wiekszy niz 1440.`, 422);
  }

  return parsed;
}

function resolveStopPostojMinutes(value, fallbackMinutes) {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 1440) {
    return parsed;
  }

  return getDefaultStopPostojMinutes({
    domyslny_czas_obslugi_min: fallbackMinutes,
  });
}

function withResolvedStopPostoj(stop, settings) {
  if (!stop) {
    return null;
  }

  return {
    ...stop,
    czas_postoju_min: resolveStopPostojMinutes(
      stop?.czas_postoju_min,
      getDefaultStopPostojMinutes(settings),
    ),
  };
}

function normalizeStopPostojMap(rawMap = {}) {
  if (rawMap == null) {
    return {};
  }

  if (typeof rawMap !== "object" || Array.isArray(rawMap)) {
    throw createHttpError("Nieprawidlowe czasy postoju dla punktow.", 422);
  }

  return Object.fromEntries(
    Object.entries(rawMap)
      .map(([reklamacjaId, value]) => [
        reklamacjaId,
        parseStopPostojMinutes(
          value,
          `Czas postoju dla punktu ${reklamacjaId}`,
        ),
      ])
      .filter(([, value]) => value != null),
  );
}

function buildStopPostojMap({
  reklamacjeIds = [],
  rawMap = {},
  settings = null,
  existingStopsByComplaintId = null,
}) {
  const validatedMap = normalizeStopPostojMap(rawMap);
  const fallbackMinutes = getDefaultStopPostojMinutes(settings);

  return Object.fromEntries(
    reklamacjeIds.map((reklamacjaId) => {
      const existingStop = existingStopsByComplaintId?.get(reklamacjaId);

      return [
        reklamacjaId,
        validatedMap[reklamacjaId] ??
          resolveStopPostojMinutes(
            existingStop?.czas_postoju_min,
            fallbackMinutes,
          ),
      ];
    }),
  );
}

function normalizeRoute(route) {
  if (!route) {
    return null;
  }

  return {
    ...route,
    smsConfirmationsSentAt: route.sms_potwierdzenia_wyslane_at || null,
  };
}

function getStopSmsStatus(stop) {
  return (
    stop?.sms_potwierdzenie_status ||
    stop?.smsConfirmationStatus ||
    SMS_CONFIRMATION_STATUS.NOT_SENT
  );
}

function normalizeRouteStop(stop) {
  if (!stop) {
    return null;
  }

  const smsStatus = getStopSmsStatus(stop);

  return {
    ...stop,
    sms_potwierdzenie_status: smsStatus,
    smsConfirmationStatus: smsStatus,
    smsConfirmationSentAt: stop.sms_potwierdzenie_sent_at || null,
    smsConfirmationConfirmedAt: stop.sms_potwierdzenie_confirmed_at || null,
    smsConfirmationShortUrl: stop.sms_potwierdzenie_short_url || null,
  };
}

function buildSmsStateSnapshot(stop) {
  return {
    sms_potwierdzenie_status: getStopSmsStatus(stop),
    sms_potwierdzenie_sent_at: stop?.sms_potwierdzenie_sent_at || null,
    sms_potwierdzenie_confirmed_at:
      stop?.sms_potwierdzenie_confirmed_at || null,
    sms_potwierdzenie_short_url: stop?.sms_potwierdzenie_short_url || null,
    has_active_token: Boolean(stop?.sms_potwierdzenie_token_hash),
  };
}

function hasAnySmsConfirmationState(stop) {
  return Boolean(
    getStopSmsStatus(stop) !== SMS_CONFIRMATION_STATUS.NOT_SENT ||
      stop?.sms_potwierdzenie_sent_at ||
      stop?.sms_potwierdzenie_confirmed_at ||
      stop?.sms_potwierdzenie_token_hash ||
      stop?.sms_potwierdzenie_short_url,
  );
}

function isStopAwaitingConfirmationSms(stop) {
  return getStopSmsStatus(stop) === SMS_CONFIRMATION_STATUS.NOT_SENT;
}

function defaultSmsStatePatch() {
  return {
    sms_potwierdzenie_status: SMS_CONFIRMATION_STATUS.NOT_SENT,
    sms_potwierdzenie_sent_at: null,
    sms_potwierdzenie_confirmed_at: null,
    sms_potwierdzenie_token_hash: null,
    sms_potwierdzenie_short_url: null,
  };
}

async function loadRouteRecord(routeId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("trasy")
    .select("*")
    .eq("id", routeId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function loadRouteStops(routeId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("trasy_punkty")
    .select("*, reklamacje(*), trasy(*)")
    .eq("trasa_id", routeId)
    .order("kolejnosc", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(normalizeRouteStop);
}

async function loadRouteStop(routeId, stopId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("trasy_punkty")
    .select("*, reklamacje(*), trasy(*)")
    .eq("trasa_id", routeId)
    .eq("id", stopId)
    .single();

  if (error) {
    throw error;
  }

  return normalizeRouteStop(data);
}

async function loadRouteStopByToken(token) {
  const tokenHash = hashSmsConfirmationToken(token);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("trasy_punkty")
    .select("*, reklamacje(*), trasy(*)")
    .eq("sms_potwierdzenie_token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createHttpError("Link potwierdzenia jest niewazny lub wygasl.", 404);
  }

  return normalizeRouteStop(data);
}

async function updateRouteSmsBatchTimestamp(routeId, timestamp) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("trasy")
    .update({ sms_potwierdzenia_wyslane_at: timestamp })
    .eq("id", routeId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return normalizeRoute(data);
}

async function updateRouteStopSmsState(stopId, changes) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("trasy_punkty")
    .update(changes)
    .eq("id", stopId)
    .select("*, reklamacje(*), trasy(*)")
    .single();

  if (error) {
    throw error;
  }

  return normalizeRouteStop(data);
}

async function createComplaintRouteLog({
  stop,
  action,
  actor = null,
  actorPayload = null,
  beforeState = null,
  afterState = null,
  metadata = {},
}) {
  await createOperationalLog({
    entity_type: "reklamacja",
    entity_id: stop.reklamacja_id,
    reklamacja_id: stop.reklamacja_id,
    trasa_id: stop.trasa_id || stop.trasy?.id || null,
    trasa_punkt_id: null,
    action,
    before_state: beforeState,
    after_state: afterState,
    metadata,
    ...(actor ? actorToLogPayload(actor) : actorPayload || {}),
  });
}

async function createRouteLog({
  route,
  action,
  actor,
  beforeState = null,
  afterState = null,
  metadata = {},
}) {
  await createOperationalLog({
    entity_type: "trasa",
    entity_id: route.id,
    trasa_id: route.id,
    trasa_punkt_id: null,
    reklamacja_id: null,
    action,
    before_state: beforeState,
    after_state: afterState,
    metadata,
    ...actorToLogPayload(actor),
  });
}

function ensurePlannedRoute(
  route,
  message = "SMS potwierdzen mozna wysylac tylko dla zaplanowanej trasy.",
) {
  if (route?.status !== ROUTE_STATUS.PLANNED) {
    throw createHttpError(message, 409);
  }
}

function ensureSmsManualInteractionAllowed(route) {
  if (
    ![ROUTE_STATUS.PLANNED, ROUTE_STATUS.IN_PROGRESS].includes(route?.status)
  ) {
    throw createHttpError(
      "Lampke SMS mozna zmieniac tylko dla trasy zaplanowanej albo w trasie.",
      409,
    );
  }
}

function ensurePublicTokenIsActive(stop) {
  if (
    [ROUTE_STATUS.CANCELLED, ROUTE_STATUS.COMPLETED].includes(
      stop?.trasy?.status,
    ) ||
    ROUTE_STOP_FINAL_STATUSES.includes(stop?.status)
  ) {
    throw createHttpError("Link potwierdzenia jest juz nieaktywny.", 410);
  }
}

function getRouteBaseAddress(route, settings) {
  return (
    settings ||
    (route.base_address_snapshot
      ? { adres_bazy: route.base_address_snapshot }
      : null)
  );
}

function buildRouteMapPreview(stops, route, settings) {
  const fallbackStopPostojMinutes = getDefaultStopPostojMinutes(settings);

  return {
    shouldCompute: Boolean(settings && (stops || []).length),
    stops: (stops || [])
      .map((stop) => {
        if (!stop?.reklamacje) {
          return null;
        }

        return {
          ...stop.reklamacje,
          id: stop.reklamacja_id || stop.reklamacje.id,
          reklamacja_id: stop.reklamacja_id || stop.reklamacje.id,
          czas_postoju_min: resolveStopPostojMinutes(
            stop?.czas_postoju_min,
            fallbackStopPostojMinutes,
          ),
        };
      })
      .filter(Boolean),
    departureTime: route.planowany_start_at,
    serviceDurationMinutes: fallbackStopPostojMinutes,
    windowMinutes:
      settings?.szerokosc_okna_min ??
      DEFAULT_OPERATIONAL_SETTINGS.szerokosc_okna_min,
  };
}

function buildConfirmationMessage({ settings, stop, shortUrl }) {
  if (!settings?.sms_kontakt_telefon) {
    throw createHttpError(
      "W ustawieniach brakuje numeru telefonu kontaktowego do SMS potwierdzen.",
      422,
    );
  }

  return renderSmsTemplate(settings.sms_szablon_potwierdzenia, {
    okno: formatRouteSmsWindow(stop),
    link: shortUrl,
    telefon: settings.sms_kontakt_telefon,
    nazwa_mebla: stop?.reklamacje?.nazwa_mebla || stop?.nazwa_mebla || "",
    adres: formatStopComplaintAddress(stop),
  });
}

function buildRouteStartMessage({ settings, stop }) {
  return renderSmsTemplate(settings.sms_szablon_startu_trasy, {
    okno: formatRouteSmsWindow(stop),
    telefon: settings?.sms_kontakt_telefon || "",
    link: "",
    nazwa_mebla: stop?.reklamacje?.nazwa_mebla || stop?.nazwa_mebla || "",
    adres: formatStopComplaintAddress(stop),
  });
}

function formatStopComplaintAddress(stop) {
  const complaint = stop?.reklamacje || stop || {};
  return [complaint.kod_pocztowy, complaint.miejscowosc, complaint.adres]
    .filter(Boolean)
    .join(" ");
}

function buildStopWarningLabel(stop) {
  const companyName = stop?.reklamacje?.nazwa_firmy || "punktu trasy";
  const customerName = getComplaintCustomerName(stop?.reklamacje) || "";
  return [companyName, customerName].filter(Boolean).join(" / ");
}

async function logSmsFailure({
  stop,
  actor,
  notificationType,
  batch = false,
  error,
}) {
  await createComplaintRouteLog({
    stop,
    action: "route_sms_send_failed",
    actor,
    beforeState: buildSmsStateSnapshot(stop),
    afterState: buildSmsStateSnapshot(stop),
    metadata: {
      notification: notificationType,
      batch,
      error: error.message || "Nieznany blad SMS.",
    },
  });
}

async function resetStopSmsConfirmationState(stop, actor, reason) {
  if (!hasAnySmsConfirmationState(stop)) {
    return stop;
  }

  const updatedStop = await updateRouteStopSmsState(
    stop.id,
    defaultSmsStatePatch(),
  );

  await createComplaintRouteLog({
    stop,
    action: "route_sms_confirmation_reset",
    actor,
    beforeState: buildSmsStateSnapshot(stop),
    afterState: buildSmsStateSnapshot(updatedStop),
    metadata: { reason },
  });

  return updatedStop;
}

async function sendConfirmationSmsForStopInternal({
  stop,
  actor,
  settings,
  batch = false,
}) {
  if (!settings?.sms_kontakt_telefon) {
    throw createHttpError(
      "W ustawieniach brakuje numeru telefonu kontaktowego do SMS potwierdzen.",
      422,
    );
  }

  const normalizedPhone = normalizePolishPhoneNumber(
    stop?.reklamacje?.telefon_klienta || "",
  );

  if (!normalizedPhone) {
    throw createHttpError(
      `Brak poprawnego numeru telefonu klienta dla ${buildStopWarningLabel(stop)}.`,
      422,
    );
  }

  let workingStop = stop;
  const warningMessages = [];
  let resetPrevious = false;

  try {
    if (hasAnySmsConfirmationState(workingStop)) {
      workingStop = await resetStopSmsConfirmationState(
        workingStop,
        actor,
        batch ? "batch_resend" : "single_resend",
      );
      resetPrevious = true;
    }

    const confirmationToken = createSmsConfirmationToken();
    const longUrl = buildRouteConfirmationLongUrl(confirmationToken);
    let shortUrl = longUrl;
    let shortenerProvider = "raw";

    try {
      const shortened = await shortenUrlWithIdzDo(longUrl);
      shortUrl = shortened.shortUrl;
      shortenerProvider = shortened.provider;
    } catch (error) {
      warningMessages.push(
        `Nie udalo sie skrocic linku dla ${buildStopWarningLabel(
          stop,
        )}. Uzyto pelnego adresu.`,
      );
    }

    const message = buildConfirmationMessage({
      settings,
      stop: workingStop,
      shortUrl,
    });

    await sendSmsMessage({
      to: normalizedPhone,
      message,
    });

    const sentAt = new Date().toISOString();
    const updatedStop = await updateRouteStopSmsState(workingStop.id, {
      sms_potwierdzenie_status: SMS_CONFIRMATION_STATUS.SENT,
      sms_potwierdzenie_sent_at: sentAt,
      sms_potwierdzenie_confirmed_at: null,
      sms_potwierdzenie_token_hash: hashSmsConfirmationToken(confirmationToken),
      sms_potwierdzenie_short_url: shortUrl,
    });

    await createComplaintRouteLog({
      stop: updatedStop,
      action: "route_sms_confirmation_sent",
      actor,
      beforeState: buildSmsStateSnapshot(stop),
      afterState: buildSmsStateSnapshot(updatedStop),
      metadata: {
        batch,
        reset_previous: resetPrevious,
        sms_window: formatRouteSmsWindow(updatedStop),
        short_url: shortUrl,
        shortener_provider: shortenerProvider,
      },
    });

    return {
      stop: updatedStop,
      warningMessages,
    };
  } catch (error) {
    await logSmsFailure({
      stop: workingStop,
      actor,
      notificationType: "confirmation",
      batch,
      error,
    });
    error.warningMessages = warningMessages;
    throw error;
  }
}

async function sendStartSmsToStop({ stop, actor, settings }) {
  const normalizedPhone = normalizePolishPhoneNumber(
    stop?.reklamacje?.telefon_klienta || "",
  );

  if (!normalizedPhone) {
    throw createHttpError(
      `Brak poprawnego numeru telefonu klienta dla ${buildStopWarningLabel(stop)}.`,
      422,
    );
  }

  const message = buildRouteStartMessage({ settings, stop });
  await sendSmsMessage({
    to: normalizedPhone,
    message,
  });

  await createComplaintRouteLog({
    stop,
    action: "route_sms_start_sent",
    actor,
    beforeState: buildSmsStateSnapshot(stop),
    afterState: buildSmsStateSnapshot(stop),
    metadata: {
      sms_window: formatRouteSmsWindow(stop),
    },
  });
}

function buildPublicConfirmationPayload(stop, settings) {
  return {
    status: getStopSmsStatus(stop),
    windowLabel: formatRouteSmsWindow(stop),
    companyName: stop?.reklamacje?.nazwa_firmy || "Reklamacja",
    customerName: getComplaintCustomerName(stop?.reklamacje),
    routeName:
      stop?.trasy?.nazwa || stop?.trasy?.numer || stop?.trasa_id || "Trasa",
    routeNumber: stop?.trasy?.numer || null,
    complaintNumber:
      stop?.reklamacje?.nr_reklamacji ||
      stop?.reklamacje?.numer_faktury ||
      null,
    address: formatStopComplaintAddress(stop),
    contactPhone: settings?.sms_kontakt_telefon || null,
    contactPhoneHref: getPhoneHref(settings?.sms_kontakt_telefon || null),
    canConfirm: getStopSmsStatus(stop) !== SMS_CONFIRMATION_STATUS.CONFIRMED,
  };
}

export async function listActiveRoutes({ dateFrom, dateTo, statuses } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("trasy")
    .select("*")
    .order("data_trasy", { ascending: true })
    .order("planowany_start_at", { ascending: true });

  if (statuses?.length) {
    query = query.in("status", statuses);
  }

  if (dateFrom) {
    query = query.gte("data_trasy", dateFrom);
  }

  if (dateTo) {
    query = query.lte("data_trasy", dateTo);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data || []).map(normalizeRoute);
}

export async function getRouteDetail(routeId) {
  const supabase = getSupabaseAdmin();
  const route = normalizeRoute(await loadRouteRecord(routeId));
  const settings = await getOperationalSettings({ required: false });
  const stops = (await loadRouteStops(routeId)).map((stop) =>
    withResolvedStopPostoj(stop, settings),
  );

  const { data: logs, error: logsError } = await supabase
    .from("logi_operacyjne")
    .select("*")
    .eq("trasa_id", routeId)
    .order("created_at", { ascending: false });

  if (logsError) {
    throw logsError;
  }

  let encodedPolyline = null;
  let returnLegDurationSeconds = null;
  let returnEtaAt = null;

  const mapPreview = buildRouteMapPreview(stops, route, settings);

  if (mapPreview.shouldCompute) {
    try {
      const planned = await computeRoutePlan({
        base: settings,
        stops: mapPreview.stops,
        departureTime: mapPreview.departureTime,
        optimize: false,
        serviceDurationMinutes: mapPreview.serviceDurationMinutes,
        windowMinutes: mapPreview.windowMinutes,
      });

      encodedPolyline = planned.encodedPolyline || null;
      returnLegDurationSeconds = planned.returnLegDurationSeconds ?? null;
      returnEtaAt = planned.returnEtaAt ?? null;
    } catch (error) {
      console.warn(
        `Nie udalo sie przeliczyc polilinii dla trasy ${routeId}:`,
        error,
      );
    }
  }

  return {
    route,
    mapBase: getRouteBaseAddress(route, settings),
    encodedPolyline,
    returnLegDurationSeconds,
    returnEtaAt,
    stops,
    logs: logs || [],
  };
}

export async function listRouteCandidates() {
  const supabase = getSupabaseAdmin();
  const { data: complaints, error } = await supabase
    .from("reklamacje")
    .select("*")
    .in("status", ROUTE_CANDIDATE_STATUSES)
    .not("lat", "is", null)
    .not("lon", "is", null)
    .order("realizacja_do", { ascending: true });

  if (error) {
    throw error;
  }

  const ids = (complaints || []).map((item) => item.id);
  if (!ids.length) {
    return [];
  }

  const { data: activeStops, error: stopsError } = await supabase
    .from("trasy_punkty")
    .select("reklamacja_id,status")
    .in("reklamacja_id", ids)
    .in("status", ["planned", "in_progress"]);

  if (stopsError) {
    throw stopsError;
  }

  const blockedIds = new Set(
    (activeStops || []).map((item) => item.reklamacja_id),
  );
  return complaints.filter((item) => !blockedIds.has(item.id));
}

export async function computeRoutePreview({
  reklamacjeIds,
  planowanyStartAt,
  optimize = true,
  czasyPostojuMinByReklamacjaId = {},
  existingStopsByComplaintId = null,
}) {
  const supabase = getSupabaseAdmin();
  const settings = await getOperationalSettings({ required: true });
  const { data: complaints, error } = await supabase
    .from("reklamacje")
    .select("*")
    .in("id", reklamacjeIds);

  if (error) {
    throw error;
  }

  const stopPostojMap = buildStopPostojMap({
    reklamacjeIds,
    rawMap: czasyPostojuMinByReklamacjaId,
    settings,
    existingStopsByComplaintId,
  });

  const orderedSelection = reklamacjeIds
    .map((id) => complaints.find((item) => item.id === id))
    .filter(Boolean)
    .map((item) => ({
      ...item,
      czas_postoju_min: stopPostojMap[item.id],
    }));

  const planned = await computeRoutePlan({
    base: settings,
    stops: orderedSelection,
    departureTime: planowanyStartAt,
    optimize,
    serviceDurationMinutes:
      settings.domyslny_czas_obslugi_min ??
      DEFAULT_OPERATIONAL_SETTINGS.domyslny_czas_obslugi_min,
    windowMinutes:
      settings.szerokosc_okna_min ??
      DEFAULT_OPERATIONAL_SETTINGS.szerokosc_okna_min,
  });

  return {
    settings,
    ...planned,
  };
}

export async function createRoute({
  reklamacjeIds,
  planowanyStartAt,
  routeName,
  notes,
  actor,
  optimize = true,
  czasyPostojuMinByReklamacjaId = {},
}) {
  const preview = await computeRoutePreview({
    reklamacjeIds,
    planowanyStartAt,
    optimize,
    czasyPostojuMinByReklamacjaId,
  });

  if (!preview.orderedStops.length) {
    throw new Error("Nie wybrano zadnych punktow trasy.");
  }

  const dateKey = planowanyStartAt.split("T")[0];
  const supabase = getSupabaseAdmin();
  const rpcPayload = {
    p_route: {
      nazwa: routeName || null,
      data_trasy: dateKey,
      planowany_start_at: planowanyStartAt,
      status: ROUTE_STATUS.PLANNED,
      base_address_snapshot: preview.settings.adres_bazy,
      total_distance_m: preview.totalDistanceMeters,
      total_duration_s: preview.totalDurationSeconds,
      notes: notes || null,
    },
    p_stops: preview.orderedStops.map((stop, index) => ({
      reklamacja_id: stop.id,
      kolejnosc: index + 1,
      status: "planned",
      previous_reklamacja_status: stop.status,
      distance_from_prev_m: stop.distance_from_prev_m,
      duration_from_prev_s: stop.duration_from_prev_s,
      eta_from: stop.eta_from,
      eta_to: stop.eta_to,
      czas_postoju_min: stop.czas_postoju_min,
    })),
    ...actorToRpcPayload(actor),
  };

  const { data, error } = await supabase.rpc(
    "create_route_with_stops",
    rpcPayload,
  );
  if (error) {
    throw error;
  }

  return {
    routeId: data?.route_id || data?.id || data,
    preview,
  };
}

export async function recalculateRoute({
  routeId,
  reklamacjeIds,
  planowanyStartAt,
  actor,
  resetSmsConfirmations = false,
  czasyPostojuMinByReklamacjaId = {},
}) {
  const previousDetail = await getRouteDetail(routeId);
  const previousStopsByComplaintId = new Map(
    previousDetail.stops.map((stop) => [stop.reklamacja_id, stop]),
  );
  ensurePlannedRoute(
    previousDetail.route,
    "Edycja trasy jest mozliwa tylko dla trasy zaplanowanej.",
  );

  const preview = await computeRoutePreview({
    reklamacjeIds,
    planowanyStartAt,
    optimize: false,
    czasyPostojuMinByReklamacjaId,
    existingStopsByComplaintId: previousStopsByComplaintId,
  });
  const previousStatusMap = new Map(
    previousDetail.stops.map((stop) => [
      stop.reklamacja_id,
      stop.previous_reklamacja_status,
    ]),
  );

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("replace_route_stops", {
    p_route_id: routeId,
    p_planowany_start_at: planowanyStartAt,
    p_total_distance_m: preview.totalDistanceMeters,
    p_total_duration_s: preview.totalDurationSeconds,
    p_stops: preview.orderedStops.map((stop, index) => ({
      reklamacja_id: stop.id,
      kolejnosc: index + 1,
      status: "planned",
      previous_reklamacja_status:
        previousStatusMap.get(stop.id) || stop.status || REKLAMACJA_STATUS.NEW,
      distance_from_prev_m: stop.distance_from_prev_m,
      duration_from_prev_s: stop.duration_from_prev_s,
      eta_from: stop.eta_from,
      eta_to: stop.eta_to,
      czas_postoju_min: stop.czas_postoju_min,
    })),
    ...actorToRpcPayload(actor),
  });

  if (error) {
    throw error;
  }

  const refreshedStops = await loadRouteStops(routeId);
  const refreshedStopMap = new Map(
    refreshedStops.map((stop) => [stop.reklamacja_id, stop]),
  );

  if (resetSmsConfirmations) {
    for (const previousStop of previousDetail.stops) {
      if (!hasAnySmsConfirmationState(previousStop)) {
        continue;
      }

      const refreshedStop = refreshedStopMap.get(previousStop.reklamacja_id);
      await createComplaintRouteLog({
        stop: previousStop,
        action: "route_sms_confirmation_reset",
        actor,
        beforeState: buildSmsStateSnapshot(previousStop),
        afterState: refreshedStop ? buildSmsStateSnapshot(refreshedStop) : null,
        metadata: {
          reason: "route_recalculation_reset",
        },
      });
    }

    await updateRouteSmsBatchTimestamp(routeId, null);
  } else {
    for (const previousStop of previousDetail.stops) {
      const refreshedStop = refreshedStopMap.get(previousStop.reklamacja_id);

      if (!refreshedStop) {
        if (hasAnySmsConfirmationState(previousStop)) {
          await createComplaintRouteLog({
            stop: previousStop,
            action: "route_sms_confirmation_reset",
            actor,
            beforeState: buildSmsStateSnapshot(previousStop),
            afterState: null,
            metadata: {
              reason: "route_removed_from_route",
            },
          });
        }
        continue;
      }

      if (!hasAnySmsConfirmationState(previousStop)) {
        continue;
      }

      await updateRouteStopSmsState(refreshedStop.id, {
        sms_potwierdzenie_status: getStopSmsStatus(previousStop),
        sms_potwierdzenie_sent_at:
          previousStop.sms_potwierdzenie_sent_at || null,
        sms_potwierdzenie_confirmed_at:
          previousStop.sms_potwierdzenie_confirmed_at || null,
        sms_potwierdzenie_token_hash:
          previousStop.sms_potwierdzenie_token_hash || null,
        sms_potwierdzenie_short_url:
          previousStop.sms_potwierdzenie_short_url || null,
      });
    }
  }

  return {
    preview,
    result: data,
  };
}

export async function sendRouteConfirmationSmsBatch(routeId, actor) {
  const detail = await getRouteDetail(routeId);
  ensurePlannedRoute(detail.route);
  const stopsToSend = detail.stops.filter(isStopAwaitingConfirmationSms);

  if (!stopsToSend.length) {
    throw createHttpError(
      "Brak punktow z szara lampka do zbiorczej wysylki SMS.",
      409,
    );
  }

  const settings = await getOperationalSettings({ required: true });
  const warnings = [];
  let sentCount = 0;
  let failedCount = 0;

  for (const stop of stopsToSend) {
    try {
      const result = await sendConfirmationSmsForStopInternal({
        stop,
        actor,
        settings,
        batch: true,
      });
      sentCount += 1;
      warnings.push(...(result.warningMessages || []));
    } catch (error) {
      failedCount += 1;
      warnings.push(
        error.message ||
          `Nie udalo sie wyslac SMS dla ${buildStopWarningLabel(stop)}.`,
      );
    }
  }

  let route = detail.route;
  const beforeState = {
    sms_potwierdzenia_wyslane_at:
      detail.route.sms_potwierdzenia_wyslane_at || null,
  };

  if (sentCount > 0) {
    route = await updateRouteSmsBatchTimestamp(
      routeId,
      new Date().toISOString(),
    );

    await createRouteLog({
      route,
      action: "route_sms_confirmation_batch_sent",
      actor,
      beforeState,
      afterState: {
        sms_potwierdzenia_wyslane_at:
          route.sms_potwierdzenia_wyslane_at || null,
      },
      metadata: {
        total_count: stopsToSend.length,
        sent_count: sentCount,
        failed_count: failedCount,
        skipped_count: detail.stops.length - stopsToSend.length,
      },
    });
  }

  return {
    route,
    sentCount,
    failedCount,
    totalCount: stopsToSend.length,
    skippedCount: detail.stops.length - stopsToSend.length,
    warnings,
  };
}

export async function sendRouteStopConfirmationSms(routeId, stopId, actor) {
  const route = normalizeRoute(await loadRouteRecord(routeId));
  ensurePlannedRoute(route);
  const stop = await loadRouteStop(routeId, stopId);
  const settings = await getOperationalSettings({ required: true });
  const result = await sendConfirmationSmsForStopInternal({
    stop,
    actor,
    settings,
    batch: false,
  });

  return {
    stop: result.stop,
    warnings: result.warningMessages || [],
  };
}

export async function updateRouteStopSmsConfirmationStatus({
  routeId,
  stopId,
  status,
  actor,
}) {
  if (!Object.values(SMS_CONFIRMATION_STATUS).includes(status)) {
    throw createHttpError("Wybrany status lampki SMS jest nieprawidlowy.", 422);
  }

  const stop = await loadRouteStop(routeId, stopId);
  ensureSmsManualInteractionAllowed(stop.trasy);

  const nextPatch = {
    sms_potwierdzenie_status: status,
    sms_potwierdzenie_token_hash: null,
    sms_potwierdzenie_short_url: null,
    sms_potwierdzenie_confirmed_at:
      status === SMS_CONFIRMATION_STATUS.CONFIRMED
        ? stop.sms_potwierdzenie_confirmed_at || new Date().toISOString()
        : null,
  };

  if (status === SMS_CONFIRMATION_STATUS.NOT_SENT) {
    nextPatch.sms_potwierdzenie_sent_at = null;
  }

  const updatedStop = await updateRouteStopSmsState(stopId, nextPatch);

  await createComplaintRouteLog({
    stop: updatedStop,
    action: "route_sms_confirmation_status_changed_manual",
    actor,
    beforeState: buildSmsStateSnapshot(stop),
    afterState: buildSmsStateSnapshot(updatedStop),
    metadata: {
      previous_status: getStopSmsStatus(stop),
      next_status: status,
    },
  });

  return updatedStop;
}

export async function getPublicSmsConfirmationPreview(token) {
  const stop = await loadRouteStopByToken(token);
  ensurePublicTokenIsActive(stop);
  const settings = await getOperationalSettings({ required: false });

  return buildPublicConfirmationPayload(stop, settings);
}

export async function confirmPublicSmsConfirmation(token) {
  const stop = await loadRouteStopByToken(token);
  ensurePublicTokenIsActive(stop);

  let updatedStop = stop;
  if (getStopSmsStatus(stop) !== SMS_CONFIRMATION_STATUS.CONFIRMED) {
    updatedStop = await updateRouteStopSmsState(stop.id, {
      sms_potwierdzenie_status: SMS_CONFIRMATION_STATUS.CONFIRMED,
      sms_potwierdzenie_confirmed_at: new Date().toISOString(),
    });

    await createComplaintRouteLog({
      stop: updatedStop,
      action: "route_sms_confirmation_confirmed",
      actorPayload: {
        actor_firma_id: null,
        actor_email: "public-link",
        actor_role: "public",
      },
      beforeState: buildSmsStateSnapshot(stop),
      afterState: buildSmsStateSnapshot(updatedStop),
      metadata: {
        source: "public_link",
      },
    });
  }

  const settings = await getOperationalSettings({ required: false });
  return buildPublicConfirmationPayload(updatedStop, settings);
}

export async function logPublicSmsConfirmationCall(token) {
  const stop = await loadRouteStopByToken(token);
  ensurePublicTokenIsActive(stop);
  const settings = await getOperationalSettings({ required: false });

  if (!settings?.sms_kontakt_telefon) {
    throw createHttpError(
      "Brak numeru telefonu kontaktowego w ustawieniach.",
      422,
    );
  }

  await createComplaintRouteLog({
    stop,
    action: "route_sms_confirmation_call_clicked",
    actorPayload: {
      actor_firma_id: null,
      actor_email: "public-link",
      actor_role: "public",
    },
    beforeState: buildSmsStateSnapshot(stop),
    afterState: buildSmsStateSnapshot(stop),
    metadata: {
      contact_phone: settings.sms_kontakt_telefon,
    },
  });

  return {
    contactPhone: settings.sms_kontakt_telefon,
    contactPhoneHref: getPhoneHref(settings.sms_kontakt_telefon),
  };
}

export async function startRoute(routeId, actor) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("start_route", {
    p_route_id: routeId,
    ...actorToRpcPayload(actor),
  });

  if (error) {
    throw error;
  }

  const warnings = [];

  try {
    const detail = await getRouteDetail(routeId);
    const pendingStops = detail.stops.filter(
      (stop) => !ROUTE_STOP_FINAL_STATUSES.includes(stop.status),
    );
    let settings = null;
    let settingsError = null;

    try {
      settings = await getOperationalSettings({ required: true });
    } catch (loadSettingsError) {
      settingsError = loadSettingsError;
    }

    for (const stop of pendingStops) {
      try {
        if (settingsError) {
          throw settingsError;
        }

        await sendStartSmsToStop({ stop, actor, settings });
      } catch (sendError) {
        await logSmsFailure({
          stop,
          actor,
          notificationType: "route_start",
          batch: false,
          error: sendError,
        });
        warnings.push(
          sendError.message ||
            `Nie udalo sie wyslac SMS startu dla ${buildStopWarningLabel(stop)}.`,
        );
      }
    }
  } catch (sendError) {
    warnings.push(
      sendError.message ||
        "Trasa wystartowala, ale nie udalo sie uruchomic wysylki SMS.",
    );
  }

  return {
    ...(data && typeof data === "object" ? data : { result: data }),
    warnings,
  };
}

export async function completeRoute(routeId, actor) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("complete_route", {
    p_route_id: routeId,
    ...actorToRpcPayload(actor),
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function deliverRouteStop(routeId, stopId, actor, payload = {}) {
  const supabase = getSupabaseAdmin();
  const closePayload = validateComplaintClosePayload(payload);
  const { data, error } = await supabase.rpc("deliver_route_stop", {
    p_route_id: routeId,
    p_stop_id: stopId,
    p_opis_przebiegu: closePayload.opis_przebiegu,
    p_zalacznik_pdf_zakonczenie: closePayload.zalacznik_pdf_zakonczenie,
    p_zalacznik_zakonczenie: closePayload.zalacznik_zakonczenie,
    ...actorToRpcPayload(actor),
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function undeliverRouteStop(routeId, stopId, actor, payload = {}) {
  const supabase = getSupabaseAdmin();
  const undeliverPayload = validateRouteUndeliverPayload(payload);
  const { data, error } = await supabase.rpc("undeliver_route_stop", {
    p_route_id: routeId,
    p_stop_id: stopId,
    p_informacje: undeliverPayload.informacje,
    ...actorToRpcPayload(actor),
  });

  if (error) {
    throw error;
  }

  return data;
}

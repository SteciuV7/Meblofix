import {
  DEFAULT_OPERATIONAL_SETTINGS,
  REKLAMACJA_STATUS,
  ROLE,
  ROUTE_CANDIDATE_STATUSES,
  ROUTE_STATUS,
} from "@/lib/constants";
import { actorToLogPayload } from "@/lib/server/auth";
import { computeRoutePlan } from "@/lib/server/google-maps";
import { getOperationalSettings } from "@/lib/server/operational";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

function buildRouteNumber(dateKey, sequence) {
  return `TR-${dateKey.replaceAll("-", "")}-${String(sequence).padStart(3, "0")}`;
}

async function nextRouteNumberForDate(dateKey) {
  const supabase = getSupabaseAdmin();
  const prefix = `TR-${dateKey.replaceAll("-", "")}`;
  const { count, error } = await supabase
    .from("trasy")
    .select("id", { count: "exact", head: true })
    .ilike("numer", `${prefix}%`);

  if (error) {
    throw error;
  }

  return buildRouteNumber(dateKey, (count || 0) + 1);
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

  const routes = data || [];
  const driverIds = [...new Set(routes.map((route) => route.driver_firma_id).filter(Boolean))];
  if (!driverIds.length) {
    return routes;
  }

  const { data: drivers, error: driversError } = await supabase
    .from("firmy")
    .select("firma_id,nazwa_firmy,email")
    .in("firma_id", driverIds);

  if (driversError) {
    throw driversError;
  }

  const driverMap = new Map((drivers || []).map((driver) => [driver.firma_id, driver]));
  return routes.map((route) => ({
    ...route,
    driver: route.driver_firma_id ? driverMap.get(route.driver_firma_id) || null : null,
  }));
}

export async function getRouteDetail(routeId) {
  const supabase = getSupabaseAdmin();
  const { data: route, error: routeError } = await supabase
    .from("trasy")
    .select("*")
    .eq("id", routeId)
    .single();

  if (routeError) {
    throw routeError;
  }

  const { data: stops, error: stopsError } = await supabase
    .from("trasy_punkty")
    .select("*, reklamacje(*)")
    .eq("trasa_id", routeId)
    .order("kolejnosc", { ascending: true });

  if (stopsError) {
    throw stopsError;
  }

  const { data: logs, error: logsError } = await supabase
    .from("logi_operacyjne")
    .select("*")
    .eq("trasa_id", routeId)
    .order("created_at", { ascending: false });

  if (logsError) {
    throw logsError;
  }

  let driver = null;
  if (route.driver_firma_id) {
    const driverQuery = await supabase
      .from("firmy")
      .select("firma_id,nazwa_firmy,email")
      .eq("firma_id", route.driver_firma_id)
      .maybeSingle();

    if (driverQuery.error) {
      throw driverQuery.error;
    }

    driver = driverQuery.data;
  }

  return {
    route: {
      ...route,
      driver,
    },
    stops: stops || [],
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

  const blockedIds = new Set((activeStops || []).map((item) => item.reklamacja_id));
  return complaints.filter((item) => !blockedIds.has(item.id));
}

export async function computeRoutePreview({
  reklamacjeIds,
  planowanyStartAt,
  optimize = true,
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

  const orderedSelection = reklamacjeIds
    .map((id) => complaints.find((item) => item.id === id))
    .filter(Boolean);

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
  driverFirmaId,
  routeName,
  notes,
  actor,
  optimize = true,
}) {
  const preview = await computeRoutePreview({
    reklamacjeIds,
    planowanyStartAt,
    optimize,
  });

  if (!preview.orderedStops.length) {
    throw new Error("Nie wybrano żadnych punktów trasy.");
  }

  const dateKey = planowanyStartAt.split("T")[0];
  const routeNumber = await nextRouteNumberForDate(dateKey);
  const supabase = getSupabaseAdmin();
  const rpcPayload = {
    p_route: {
      numer: routeNumber,
      nazwa: routeName || null,
      data_trasy: dateKey,
      planowany_start_at: planowanyStartAt,
      status: ROUTE_STATUS.PLANNED,
      driver_firma_id: driverFirmaId || actor.firma_id,
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
    })),
    ...actorToLogPayload(actor),
  };

  const { data, error } = await supabase.rpc("create_route_with_stops", rpcPayload);
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
}) {
  const routeDetail = await getRouteDetail(routeId);
  const preview = await computeRoutePreview({
    reklamacjeIds,
    planowanyStartAt,
    optimize: false,
  });
  const previousStatusMap = new Map(
    routeDetail.stops.map((stop) => [stop.reklamacja_id, stop.previous_reklamacja_status])
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
    })),
    ...actorToLogPayload(actor),
  });

  if (error) {
    throw error;
  }

  return {
    preview,
    result: data,
  };
}

export async function startRoute(routeId, actor) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("start_route", {
    p_route_id: routeId,
    ...actorToLogPayload(actor),
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function completeRoute(routeId, actor) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("complete_route", {
    p_route_id: routeId,
    ...actorToLogPayload(actor),
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function deliverRouteStop(routeId, stopId, actor) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("deliver_route_stop", {
    p_route_id: routeId,
    p_stop_id: stopId,
    ...actorToLogPayload(actor),
  });

  if (error) {
    throw error;
  }

  return data;
}

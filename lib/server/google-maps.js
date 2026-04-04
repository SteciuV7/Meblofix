import { DEFAULT_OPERATIONAL_SETTINGS } from "@/lib/constants";
import { parseDurationSeconds, toNumber } from "@/lib/utils";

function getMapsApiKey() {
  return (
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  );
}

export async function geocodeAddressServer(address) {
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    throw new Error("Brak klucza Google Maps API po stronie serwera.");
  }

  const params = new URLSearchParams({
    address,
    key: apiKey,
    language: "pl",
    region: "PL",
    components: "country:PL",
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Google Geocoding API zwrocil ${response.status}.`);
  }

  const payload = await response.json();

  if (payload.status !== "OK" || !payload.results?.length) {
    throw new Error("Nie udalo sie zgeokodowac adresu.");
  }

  const result = payload.results[0];
  return {
    lat: result.geometry.location.lat,
    lon: result.geometry.location.lng,
    raw: result,
  };
}

function toWaypoint(lat, lon) {
  const latitude = toNumber(lat);
  const longitude = toNumber(lon);

  if (latitude == null || longitude == null) {
    throw new Error("Punkt trasy nie ma poprawnych wspolrzednych.");
  }

  return {
    location: {
      latLng: {
        latitude,
        longitude,
      },
    },
  };
}

function normalizeStopCoordinates(stop, index) {
  const lat = toNumber(stop?.lat);
  const lon = toNumber(stop?.lon);

  if (lat == null || lon == null) {
    const label =
      stop?.nazwa_firmy ||
      stop?.numer_faktury ||
      stop?.id ||
      `#${index + 1}`;

    throw new Error(`Punkt trasy "${label}" nie ma poprawnych wspolrzednych.`);
  }

  return {
    ...stop,
    lat,
    lon,
  };
}

function buildEtaWindows({
  orderedStops,
  legs,
  departureTime,
  serviceDurationMinutes,
  windowMinutes,
}) {
  let cursor = new Date(departureTime);

  return orderedStops.map((stop, index) => {
    const leg = legs[index];
    const durationSeconds = parseDurationSeconds(leg?.duration);
    cursor = new Date(cursor.getTime() + durationSeconds * 1000);
    const etaFrom = new Date(cursor);
    const etaTo = new Date(etaFrom.getTime() + windowMinutes * 60 * 1000);

    cursor = new Date(
      etaFrom.getTime() + serviceDurationMinutes * 60 * 1000
    );

    return {
      ...stop,
      distance_from_prev_m: leg?.distanceMeters ?? 0,
      duration_from_prev_s: durationSeconds,
      eta_from: etaFrom.toISOString(),
      eta_to: etaTo.toISOString(),
    };
  });
}

function buildRoutingOptions(departureTime) {
  const parsedDepartureTime = departureTime ? new Date(departureTime) : null;
  const hasValidDepartureTime =
    parsedDepartureTime && !Number.isNaN(parsedDepartureTime.getTime());
  const hasFutureDepartureTime =
    hasValidDepartureTime &&
    parsedDepartureTime.getTime() > Date.now() + 60 * 1000;

  if (hasFutureDepartureTime) {
    return {
      routingPreference: "TRAFFIC_AWARE",
      departureTime: parsedDepartureTime.toISOString(),
    };
  }

  return {
    routingPreference: "TRAFFIC_UNAWARE",
    departureTime: null,
  };
}

async function parseRoutesError(response) {
  try {
    const payload = await response.json();
    return payload?.error?.message || payload?.message || "";
  } catch {
    return await response.text();
  }
}

function resolveOptimizedOrder(route, stopsCount) {
  const indices = route.optimizedIntermediateWaypointIndex;
  const fallback = Array.from({ length: stopsCount }, (_, index) => index);

  if (!Array.isArray(indices) || indices.length !== stopsCount) {
    return fallback;
  }

  const isValid = indices.every(
    (value) => Number.isInteger(value) && value >= 0 && value < stopsCount
  );

  return isValid ? indices : fallback;
}

export async function computeRoutePlan({
  base,
  stops,
  departureTime,
  optimize = true,
  serviceDurationMinutes = DEFAULT_OPERATIONAL_SETTINGS.domyslny_czas_obslugi_min,
  windowMinutes = DEFAULT_OPERATIONAL_SETTINGS.szerokosc_okna_min,
}) {
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    throw new Error("Brak klucza Google Routes API po stronie serwera.");
  }

  const baseLat = toNumber(base?.lat);
  const baseLon = toNumber(base?.lon);

  if (baseLat == null || baseLon == null) {
    throw new Error("Brak poprawnie skonfigurowanej bazy trasy.");
  }

  if (!Array.isArray(stops) || stops.length === 0) {
    return {
      orderedStops: [],
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      encodedPolyline: null,
    };
  }

  const normalizedStops = stops.map((stop, index) =>
    normalizeStopCoordinates(stop, index)
  );
  const routingOptions = buildRoutingOptions(departureTime);

  const requestBody = {
    origin: toWaypoint(baseLat, baseLon),
    destination: toWaypoint(baseLat, baseLon),
    intermediates: normalizedStops.map((stop) => toWaypoint(stop.lat, stop.lon)),
    travelMode: "DRIVE",
    routingPreference: routingOptions.routingPreference,
    optimizeWaypointOrder: optimize,
    languageCode: "pl-PL",
    units: "METRIC",
    ...(routingOptions.departureTime
      ? { departureTime: routingOptions.departureTime }
      : {}),
  };

  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration,routes.optimizedIntermediateWaypointIndex",
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const details = await parseRoutesError(response);
    throw new Error(
      details
        ? `Google Routes API zwrocil ${response.status}: ${details}`
        : `Google Routes API zwrocil ${response.status}.`
    );
  }

  const payload = await response.json();
  const route = payload.routes?.[0];

  if (!route) {
    throw new Error("Nie udalo sie wyliczyc trasy.");
  }

  const optimizedOrder = resolveOptimizedOrder(route, normalizedStops.length);

  const orderedStops = optimizedOrder
    .map((stopIndex) => normalizedStops[stopIndex])
    .filter(Boolean);

  const legStops = buildEtaWindows({
    orderedStops,
    legs: route.legs || [],
    departureTime,
    serviceDurationMinutes,
    windowMinutes,
  });

  return {
    orderedStops: legStops,
    totalDistanceMeters: route.distanceMeters ?? 0,
    totalDurationSeconds: parseDurationSeconds(route.duration),
    encodedPolyline: route.polyline?.encodedPolyline || null,
    raw: route,
  };
}

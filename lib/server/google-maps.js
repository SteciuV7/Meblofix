import { DEFAULT_OPERATIONAL_SETTINGS } from "@/lib/constants";
import { parseDurationSeconds, toNumber } from "@/lib/utils";

function roundDateToNearestMinutes(date, minutes = 30) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const stepMs = minutes * 60 * 1000;
  return new Date(Math.round(date.getTime() / stepMs) * stepMs);
}

function getMapsApiKey() {
  return (
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  );
}

const APPROXIMATE_ADDRESS_TYPES = new Set([
  "street_address",
  "premise",
  "subpremise",
  "route",
]);

const GEOCODE_WARNING_MESSAGES = {
  partial_match: "Google oznaczyl ten wynik jako przyblizony.",
  precision: "Google nie zwrocil dokladnego punktu adresowego.",
  town: "Miejscowosc nie zgadza sie z wpisanym adresem.",
  postal_code: "Kod pocztowy nie zgadza sie z wpisanym adresem.",
  street: "Ulica nie zgadza sie z wpisanym adresem.",
  house_number: "Numer domu lub lokalu nie zgadza sie z wpisanym adresem.",
};

function normalizeGeocodeText(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0142/g, "l")
    .replace(/\u0141/g, "L")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizePostalCode(value) {
  return (value || "").replace(/\D/g, "");
}

function getAddressComponentValues(result, types) {
  const expectedTypes = Array.isArray(types) ? types : [types];

  return (result?.address_components || [])
    .filter((component) =>
      expectedTypes.some((type) => component.types?.includes(type))
    )
    .flatMap((component) => [component.long_name, component.short_name])
    .filter(Boolean);
}

function getFirstAddressComponentValue(result, types) {
  return getAddressComponentValues(result, types)[0] || "";
}

function extractStreetName(addressLine) {
  const trimmed = (addressLine || "").trim();
  const withoutNumber = trimmed.replace(
    /\s+\d+[A-Za-z]?(?:\/\d+[A-Za-z]?)?$/u,
    ""
  );

  return normalizeGeocodeText(withoutNumber);
}

function extractPrimaryHouseNumber(addressLine) {
  const match = (addressLine || "")
    .trim()
    .match(/(\d+[A-Za-z]?)(?:\/\d+[A-Za-z]?)?$/u);

  return normalizeGeocodeText(match?.[1] || "");
}

function matchesRequestedTown(result, town) {
  const requestedTown = normalizeGeocodeText(town);
  if (!requestedTown) {
    return true;
  }

  const candidateValues = getAddressComponentValues(result, [
    "locality",
    "postal_town",
    "administrative_area_level_3",
    "administrative_area_level_2",
    "sublocality_level_1",
  ]).map(normalizeGeocodeText);

  return candidateValues.some(
    (value) =>
      value === requestedTown ||
      value.includes(requestedTown) ||
      requestedTown.includes(value)
  );
}

function matchesRequestedPostalCode(result, postalCode) {
  const requestedPostalCode = normalizePostalCode(postalCode);
  if (!requestedPostalCode) {
    return true;
  }

  const resultPostalCode = normalizePostalCode(
    getFirstAddressComponentValue(result, "postal_code")
  );

  return Boolean(resultPostalCode) && resultPostalCode === requestedPostalCode;
}

function matchesRequestedStreet(result, addressLine) {
  const requestedStreet = extractStreetName(addressLine);
  if (!requestedStreet) {
    return true;
  }

  const route = normalizeGeocodeText(
    getFirstAddressComponentValue(result, "route")
  );

  return Boolean(route) && (route.includes(requestedStreet) || requestedStreet.includes(route));
}

function matchesRequestedHouseNumber(result, addressLine) {
  const requestedHouseNumber = extractPrimaryHouseNumber(addressLine);
  if (!requestedHouseNumber) {
    return true;
  }

  const resultHouseNumber = normalizeGeocodeText(
    getFirstAddressComponentValue(result, ["street_number", "premise"])
  );

  return Boolean(resultHouseNumber) && resultHouseNumber === requestedHouseNumber;
}

function isPreciseGeocodeResult(result) {
  const locationType = result?.geometry?.location_type;
  const resultTypes = result?.types || [];

  return (
    locationType === "ROOFTOP" ||
    locationType === "RANGE_INTERPOLATED" ||
    resultTypes.includes("street_address") ||
    resultTypes.includes("premise")
  );
}

function hasCoordinates(result) {
  return (
    typeof result?.geometry?.location?.lat === "number" &&
    typeof result?.geometry?.location?.lng === "number"
  );
}

function hasApproximateAddressType(result) {
  return (result?.types || []).some((type) =>
    APPROXIMATE_ADDRESS_TYPES.has(type)
  );
}

function collectGeocodeWarnings(result, input) {
  const warnings = [];

  if (result?.partial_match) {
    warnings.push("partial_match");
  }

  if (!isPreciseGeocodeResult(result)) {
    warnings.push("precision");
  }

  if (!matchesRequestedTown(result, input.town)) {
    warnings.push("town");
  }

  if (!matchesRequestedPostalCode(result, input.postalCode)) {
    warnings.push("postal_code");
  }

  if (!matchesRequestedStreet(result, input.addressLine)) {
    warnings.push("street");
  }

  if (!matchesRequestedHouseNumber(result, input.addressLine)) {
    warnings.push("house_number");
  }

  return warnings;
}

function isStrictAddressMatch(result, input) {
  return (
    !result?.partial_match &&
    isPreciseGeocodeResult(result) &&
    matchesRequestedTown(result, input.town) &&
    matchesRequestedPostalCode(result, input.postalCode) &&
    matchesRequestedStreet(result, input.addressLine) &&
    matchesRequestedHouseNumber(result, input.addressLine)
  );
}

function isApproximateAddressMatch(result, input) {
  if (!hasCoordinates(result) || !hasApproximateAddressType(result)) {
    return false;
  }

  return (
    matchesRequestedStreet(result, input.addressLine) ||
    matchesRequestedHouseNumber(result, input.addressLine) ||
    matchesRequestedTown(result, input.town) ||
    matchesRequestedPostalCode(result, input.postalCode)
  );
}

function buildGeocodeQuery(input) {
  if (typeof input === "string") {
    return {
      query: input,
      addressLine: input,
      town: "",
      postalCode: "",
    };
  }

  const addressLine = (input?.addressLine || "").trim();
  const town = (input?.town || "").trim();
  const postalCode = (input?.postalCode || "").trim();

  return {
    query: [addressLine, town, postalCode].filter(Boolean).join(", "),
    addressLine,
    town,
    postalCode,
  };
}

function createGeocodeValidationError(message) {
  const error = new Error(message);
  error.statusCode = 422;
  return error;
}

function buildGeocodeResponse(result, request, matchType) {
  const mismatchKeys =
    matchType === "exact" ? [] : collectGeocodeWarnings(result, request);

  return {
    lat: result.geometry.location.lat,
    lon: result.geometry.location.lng,
    formattedAddress: result.formatted_address || request.query,
    locationType: result.geometry.location_type || null,
    partialMatch: Boolean(result.partial_match),
    matchType,
    mismatchKeys,
    warnings: mismatchKeys
      .map((key) => GEOCODE_WARNING_MESSAGES[key])
      .filter(Boolean),
    raw: result,
  };
}

async function fetchGeocodePayload(input) {
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    throw new Error("Brak klucza Google Maps API po stronie serwera.");
  }

  const request = buildGeocodeQuery(input);
  const params = new URLSearchParams({
    address: request.query,
    key: apiKey,
    language: "pl",
    region: "PL",
    components: "country:PL",
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
  );

  if (!response.ok) {
    const error = new Error(`Google Geocoding API zwrocil ${response.status}.`);
    error.statusCode = 502;
    throw error;
  }

  const payload = await response.json();
  return { payload, request };
}

export async function previewGeocodeAddressServer(input) {
  const { payload, request } = await fetchGeocodePayload(input);

  if (payload.status === "ZERO_RESULTS" || !payload.results?.length) {
    throw createGeocodeValidationError(
      "Adres jest niepoprawny albo nie udalo sie go jednoznacznie odnalezc."
    );
  }

  if (payload.status !== "OK") {
    const error = new Error(
      payload.error_message
        ? `Google Geocoding API zwrocil ${payload.status}: ${payload.error_message}`
        : `Google Geocoding API zwrocil ${payload.status}.`
    );
    error.statusCode = 502;
    throw error;
  }

  const exactResult =
    payload.results.find((candidate) => isStrictAddressMatch(candidate, request)) ||
    null;

  if (exactResult) {
    return buildGeocodeResponse(exactResult, request, "exact");
  }

  const approximateResult =
    payload.results.find((candidate) =>
      isApproximateAddressMatch(candidate, request)
    ) || null;

  if (approximateResult) {
    return buildGeocodeResponse(approximateResult, request, "approximate");
  }

  throw createGeocodeValidationError(
    "Adres jest niepoprawny albo Google nie potrafil wskazac wiarygodnego punktu."
  );
}

export async function geocodeAddressServer(input, { allowApproximate = false } = {}) {
  const preview = await previewGeocodeAddressServer(input);

  if (preview.matchType === "approximate" && !allowApproximate) {
    throw createGeocodeValidationError(
      "Adres zostal odnaleziony tylko przybliznie. Potwierdz go na mapie albo popraw adres."
    );
  }

  return preview;
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

  const etaStops = orderedStops.map((stop, index) => {
    const leg = legs[index];
    const durationSeconds = parseDurationSeconds(leg?.duration);
    cursor = new Date(cursor.getTime() + durationSeconds * 1000);
    const actualEtaFrom = new Date(cursor);
    const roundedEtaFrom =
      roundDateToNearestMinutes(actualEtaFrom, 30) || actualEtaFrom;
    const etaTo = new Date(
      roundedEtaFrom.getTime() + windowMinutes * 60 * 1000
    );

    cursor = new Date(
      actualEtaFrom.getTime() + serviceDurationMinutes * 60 * 1000
    );

    return {
      ...stop,
      distance_from_prev_m: leg?.distanceMeters ?? 0,
      duration_from_prev_s: durationSeconds,
      eta_from: roundedEtaFrom.toISOString(),
      eta_to: etaTo.toISOString(),
    };
  });

  return {
    orderedStops: etaStops,
    serviceEndAt:
      cursor instanceof Date && !Number.isNaN(cursor.getTime())
        ? cursor.toISOString()
        : null,
  };
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
      returnLegDurationSeconds: null,
      returnEtaAt: null,
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

  const { orderedStops: legStops, serviceEndAt } = buildEtaWindows({
    orderedStops,
    legs: route.legs || [],
    departureTime,
    serviceDurationMinutes,
    windowMinutes,
  });
  const returnLeg = route.legs?.[orderedStops.length];
  const returnLegDurationSeconds = returnLeg
    ? parseDurationSeconds(returnLeg.duration)
    : null;
  const returnEtaAt =
    serviceEndAt && returnLegDurationSeconds != null
      ? (
          roundDateToNearestMinutes(
            new Date(
              new Date(serviceEndAt).getTime() + returnLegDurationSeconds * 1000
            ),
            30
          ) ||
          new Date(
            new Date(serviceEndAt).getTime() + returnLegDurationSeconds * 1000
          )
        ).toISOString()
      : null;

  return {
    orderedStops: legStops,
    totalDistanceMeters: route.distanceMeters ?? 0,
    totalDurationSeconds: parseDurationSeconds(route.duration),
    encodedPolyline: route.polyline?.encodedPolyline || null,
    returnLegDurationSeconds,
    returnEtaAt,
    raw: route,
  };
}

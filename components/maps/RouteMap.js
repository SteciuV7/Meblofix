import { StatusBadge } from "@/components/StatusBadge";
import { RouteEtaBadge } from "@/components/trasy/RouteTiming";
import { getPublicStorageUrl } from "@/lib/storage";
import {
  getComplaintCustomerName,
  getPhoneHref,
  toNumber,
} from "@/lib/utils";
import { divIcon, latLngBounds } from "leaflet";
import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

const MAP_TONES = {
  base: "#0f172a",
  blue: "#2563eb",
  yellow: "#eab308",
  green: "#16a34a",
  red: "#ef4444",
  neutral: "#475569",
};

function buildPolyline(encodedPolyline) {
  if (!encodedPolyline) return [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < encodedPolyline.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encodedPolyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      b = encodedPolyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}

function getValidPosition(lat, lon) {
  const parsedLat = toNumber(lat);
  const parsedLon = toNumber(lon);

  if (parsedLat == null || parsedLon == null) {
    return null;
  }

  return [parsedLat, parsedLon];
}

function resolveStopOrder(stop) {
  const rawOrder = stop?.order ?? stop?.kolejnosc ?? stop?.sequence ?? null;
  const parsed = Number(rawOrder);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveStopTone(stop) {
  if (stop?.tone && MAP_TONES[stop.tone]) {
    return stop.tone;
  }

  switch (stop?.status) {
    case "planned":
      return "blue";
    case "in_progress":
      return "yellow";
    case "delivered":
    case "completed":
      return "green";
    case "undelivered":
    case "cancelled":
      return "red";
    default:
      return "neutral";
  }
}

function buildFallbackRoutePositions({ basePosition, validStops }) {
  const orderedStops = validStops
    .map((stop) => ({
      ...stop,
      _resolvedOrder: resolveStopOrder(stop),
    }))
    .filter((stop) => stop._resolvedOrder != null)
    .sort((left, right) => left._resolvedOrder - right._resolvedOrder);

  if (!orderedStops.length) {
    return [];
  }

  const positions = orderedStops.map((stop) => stop._position);

  if (!basePosition) {
    return positions;
  }

  return [basePosition, ...positions, basePosition];
}

function AutoFitBounds({ positions = [], singlePointMaxZoom = 9 }) {
  const map = useMap();
  const boundsKey = useMemo(
    () => positions.map(([lat, lon]) => `${lat}:${lon}`).join("|"),
    [positions]
  );

  useEffect(() => {
    if (!positions.length) {
      return;
    }

    const bounds = latLngBounds(positions);
    map.fitBounds(bounds, {
      padding: [36, 36],
      maxZoom: positions.length === 1 ? singlePointMaxZoom : 11,
    });
  }, [boundsKey, map, positions, singlePointMaxZoom]);

  return null;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHouseIcon() {
  return [
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="route-pin__house">',
    '<path fill="currentColor" d="M12 3.25 3 10.1V12h1.5v8.75h5.75v-5.5h3.5v5.5h5.75V12H21v-1.9L12 3.25Zm6.5 15.5h-2.75v-5.5H8.25v5.5H5.5v-7.9L12 5.75l6.5 5.1v7.9Z" />',
    "</svg>",
  ].join("");
}

function buildMarkerIcon({ tone = "neutral", selected = false, label, isBase = false }) {
  const resolvedTone = MAP_TONES[tone] ? tone : "neutral";
  const content = isBase
    ? buildHouseIcon()
    : label
      ? `<span class="route-pin__label">${escapeHtml(label)}</span>`
      : '<span class="route-pin__dot" aria-hidden="true"></span>';

  return divIcon({
    className: "route-pin-wrapper",
    html: `
      <div class="route-pin route-pin--${resolvedTone}${selected ? " route-pin--selected" : ""}">
        <div class="route-pin__inner">
          <span class="route-pin__content">${content}</span>
        </div>
      </div>
    `,
    iconSize: [40, 52],
    iconAnchor: [20, 50],
    popupAnchor: [0, -42],
  });
}

export default function RouteMap({
  base,
  stops = [],
  encodedPolyline,
  height = "520px",
  renderStopActions,
  singlePointMaxZoom = 9,
}) {
  const validStops = stops
    .map((stop, index) => ({
      ...stop,
      _position: getValidPosition(stop?.lat, stop?.lon),
      _key: stop.id || stop.reklamacja_id || index,
    }))
    .filter((stop) => stop._position);
  const basePosition = getValidPosition(base?.lat, base?.lon);
  const center = basePosition || validStops[0]?._position || [52.0693, 19.4803];
  const fitPositions = [
    ...(basePosition ? [basePosition] : []),
    ...validStops.map((stop) => stop._position),
  ];
  const polyline = buildPolyline(encodedPolyline);
  const fallbackRoutePositions = buildFallbackRoutePositions({
    basePosition,
    validStops,
  });
  const routePositions = polyline.length > 0 ? polyline : fallbackRoutePositions;

  return (
    <div className="min-w-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <MapContainer
        center={center}
        zoom={6}
        style={{ height, width: "100%" }}
        scrollWheelZoom
      >
        <AutoFitBounds
          positions={fitPositions}
          singlePointMaxZoom={singlePointMaxZoom}
        />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {basePosition ? (
          <Marker
            position={basePosition}
            icon={buildMarkerIcon({ tone: "base", isBase: true })}
          >
            <Popup>
              <div className="space-y-2 text-sm">
                <div className="font-semibold text-slate-950">Baza Meblofix</div>
                <div className="text-slate-600">{base?.adres_bazy || "Brak adresu bazy"}</div>
              </div>
            </Popup>
          </Marker>
        ) : null}

        {validStops.map((stop) => {
          const customerName = getComplaintCustomerName(
            stop.reklamacje || stop
          );
          const customerPhone =
            stop.telefon_klienta || stop.reklamacje?.telefon_klienta;
          const customerPhoneHref = getPhoneHref(customerPhone);

          return (
            <Marker
                key={stop._key}
                position={stop._position}
                icon={buildMarkerIcon({
                  tone: resolveStopTone(stop),
                  selected: stop.selected,
                  label: resolveStopOrder(stop)
                    ? String(resolveStopOrder(stop))
                    : null,
                })}
              >
                <Popup>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="font-semibold text-slate-950">
                      {stop.nazwa_firmy || stop.reklamacje?.nazwa_firmy}
                    </div>
                    <div className="mt-1 text-slate-600">
                      {stop.miejscowosc || stop.reklamacje?.miejscowosc},{" "}
                      {stop.adres || stop.reklamacje?.adres}
                    </div>
                    {customerName || customerPhone ? (
                      <div className="mt-2 space-y-1 text-slate-700">
                        {customerName ? (
                          <div className="font-medium">{customerName}</div>
                        ) : null}
                        {customerPhone ? (
                          <a
                            href={customerPhoneHref || "#"}
                            className="inline-flex text-sky-700 hover:text-sky-900"
                          >
                            {customerPhone}
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {stop.deadlineLabel ? (
                    <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {stop.deadlineLabel}
                    </div>
                  ) : null}

                  {stop.status || stop.reklamacje?.status ? (
                    <StatusBadge value={stop.status || stop.reklamacje?.status} />
                  ) : null}

                  <RouteEtaBadge etaFrom={stop.eta_from} etaTo={stop.eta_to} />

                  {stop.zalacznik_pdf || stop.reklamacje?.zalacznik_pdf ? (
                    <a
                      href={getPublicStorageUrl(
                        stop.zalacznik_pdf || stop.reklamacje?.zalacznik_pdf
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-sky-700"
                    >
                      PDF
                    </a>
                  ) : null}

                  {renderStopActions ? <div>{renderStopActions(stop)}</div> : null}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {routePositions.length > 1 ? (
          <>
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: "#ffffff",
                weight: 10,
                opacity: 0.9,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: "#0f172a",
                weight: 5,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </>
        ) : null}
      </MapContainer>
    </div>
  );
}

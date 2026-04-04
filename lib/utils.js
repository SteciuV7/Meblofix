import {
  REKLAMACJA_STATUS_LABELS,
  ROUTE_STATUS_LABELS,
  ROUTE_STOP_STATUS_LABELS,
} from "@/lib/constants";

export function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function normalizeText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L");
}

export function labelForStatus(status) {
  return (
    REKLAMACJA_STATUS_LABELS[status] ||
    ROUTE_STATUS_LABELS[status] ||
    ROUTE_STOP_STATUS_LABELS[status] ||
    status
  );
}

export function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}

export function formatDuration(seconds) {
  if (seconds == null) return "—";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function formatDistance(meters) {
  if (meters == null) return "—";
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function calculateRemainingDays(targetDate) {
  if (!targetDate) return null;
  const diffMs = new Date(targetDate) - new Date();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function dayKey(date = new Date()) {
  const current = new Date(date);
  const month = `${current.getMonth() + 1}`.padStart(2, "0");
  const day = `${current.getDate()}`.padStart(2, "0");
  return `${current.getFullYear()}-${month}-${day}`;
}

export function isoDateFromDate(date) {
  return new Date(date).toISOString().split("T")[0];
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function parseDurationSeconds(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  const match = /^(\d+)s$/.exec(value);
  return match ? Number(match[1]) : 0;
}

export function toNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function removePolishCharacters(text = "") {
  return normalizeText(text);
}

export function getRouteDisplayName(route) {
  return route?.nazwa || route?.numer || "Trasa";
}

import {
  OPERATIONAL_LOG_ACTION_LABELS,
  REKLAMACJA_STATUS_LABELS,
  SMS_CONFIRMATION_STATUS_LABELS,
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
    .replace(/\u0142/g, "l")
    .replace(/\u0141/g, "L");
}

export function labelForStatus(status) {
  return (
    REKLAMACJA_STATUS_LABELS[status] ||
    ROUTE_STATUS_LABELS[status] ||
    SMS_CONFIRMATION_STATUS_LABELS[status] ||
    ROUTE_STOP_STATUS_LABELS[status] ||
    status
  );
}

export function labelForOperationalAction(action) {
  return OPERATIONAL_LOG_ACTION_LABELS[action] || action;
}

export function formatDate(value, withTime = false) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

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

export function roundDateValueToNearestMinutes(value, minutes = 30) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const stepMs = minutes * 60 * 1000;
  return new Date(Math.round(date.getTime() / stepMs) * stepMs);
}

export function formatEtaDate(value) {
  const rounded = roundDateValueToNearestMinutes(value, 30);
  return formatDate(rounded || value, true);
}

export function formatDuration(seconds) {
  if (seconds == null) return "-";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function formatDistance(meters) {
  if (meters == null) return "-";
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

export function normalizePolishPhoneNumber(value = "") {
  const compact = String(value).trim().replace(/[\s-]+/g, "");

  if (!compact) {
    return "";
  }

  const localNumber = /^\d{9}$/.test(compact)
    ? compact
    : /^\+48\d{9}$/.test(compact)
      ? compact.slice(3)
      : /^48\d{9}$/.test(compact)
        ? compact.slice(2)
        : null;

  if (!localNumber) {
    return "";
  }

  return `+48 ${localNumber.slice(0, 3)} ${localNumber.slice(
    3,
    6
  )} ${localNumber.slice(6)}`;
}

export function formatSmsTimeWindow(etaFrom, etaTo) {
  if (!etaFrom) {
    return "-";
  }

  const fromDate = new Date(etaFrom);
  if (Number.isNaN(fromDate.getTime())) {
    return "-";
  }

  const datePart = new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(fromDate);

  const fromTime = new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Warsaw",
  }).format(fromDate);

  if (!etaTo) {
    return `${datePart} ${fromTime}`;
  }

  const toDate = new Date(etaTo);
  if (Number.isNaN(toDate.getTime())) {
    return `${datePart} ${fromTime}`;
  }

  const toTime = new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Warsaw",
  }).format(toDate);

  return `${datePart} ${fromTime}-${toTime}`;
}

export function getRouteDisplayName(route) {
  return route?.nazwa || route?.numer || "Trasa";
}

export function getComplaintCustomerName(complaint = {}) {
  const firstName = `${complaint?.imie_klienta || ""}`.trim();
  const lastName = `${complaint?.nazwisko_klienta || ""}`.trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  return fullName || null;
}

export function getPhoneHref(phone) {
  if (!phone) {
    return null;
  }

  const normalized = String(phone).replace(/[^\d+]/g, "");
  if (!normalized) {
    return null;
  }

  return `tel:${normalized}`;
}

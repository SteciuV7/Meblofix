import {
  OPERATIONAL_LOG_ACTION_LABELS,
  REKLAMACJA_STATUS,
  REKLAMACJA_STATUS_LABELS,
  SMS_CONFIRMATION_STATUS,
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

function formatLogDate(value, withTime = true) {
  if (!value) {
    return null;
  }

  const formatted = formatDate(value, withTime);
  return formatted === "-" ? null : formatted;
}

function formatRouteSuffix(log) {
  const routeNumber =
    log?.metadata?.trasa_numer ||
    log?.after_state?.numer ||
    log?.before_state?.numer ||
    null;

  return routeNumber ? ` na trasie ${routeNumber}` : "";
}

function formatActionWithOptionalDate(message, dateValue) {
  const dateLabel = formatLogDate(dateValue, true);
  return dateLabel ? `${message} o ${dateLabel}` : message;
}

function getLogStatusChange(log, beforeKey, afterKey) {
  const beforeStatus =
    log?.metadata?.previous_status ||
    log?.metadata?.previousStatus ||
    log?.before_state?.[beforeKey] ||
    null;
  const afterStatus =
    log?.metadata?.next_status ||
    log?.metadata?.nextStatus ||
    log?.after_state?.[afterKey] ||
    null;

  if (!beforeStatus || !afterStatus) {
    return null;
  }

  return {
    before: labelForStatus(beforeStatus),
    after: labelForStatus(afterStatus),
  };
}

function getLogNextStatus(log, key) {
  return (
    log?.metadata?.next_status ||
    log?.metadata?.nextStatus ||
    log?.after_state?.[key] ||
    null
  );
}

const DANGER_OPERATIONAL_LOG_ACTIONS = new Set([
  "route_sms_confirmation_rejected",
  "route_undelivered",
  "route_stop_undelivered",
  "route_sms_send_failed",
]);

const SUCCESS_OPERATIONAL_LOG_ACTIONS = new Set([
  "route_sms_confirmation_confirmed",
  "route_delivered",
  "route_stop_delivered",
  "reklamacja_closed_manual",
  "route_completed",
]);

const WARNING_OPERATIONAL_LOG_ACTIONS = new Set([
  "route_sms_confirmation_sent",
  "route_sms_confirmation_batch_sent",
  "reklamacja_waiting_delivery",
  "reklamacja_realizacja_do_updated_from_sms_confirmation",
  "route_cancelled",
  "route_unassigned",
  "route_stop_removed",
]);

const INFO_OPERATIONAL_LOG_ACTIONS = new Set([
  "route_created",
  "route_assigned",
  "route_stop_created",
  "route_started",
  "route_stop_started",
  "route_sms_start_sent",
  "reklamacja_created",
  "reklamacja_accepted",
]);

export function getOperationalLogTone(log) {
  const action = log?.action;

  if (action === "route_sms_confirmation_status_changed_manual") {
    const nextStatus = getLogNextStatus(log, "sms_potwierdzenie_status");

    if (nextStatus === SMS_CONFIRMATION_STATUS.MANUAL_REJECTED) {
      return "danger";
    }

    if (nextStatus === SMS_CONFIRMATION_STATUS.CONFIRMED) {
      return "success";
    }

    if (nextStatus === SMS_CONFIRMATION_STATUS.SENT) {
      return "warning";
    }

    return "neutral";
  }

  if (action === "reklamacja_status_changed_manual") {
    const nextStatus = getLogNextStatus(log, "status");

    if (nextStatus === REKLAMACJA_STATUS.WAITING_DELIVERY) {
      return "warning";
    }

    if (nextStatus === REKLAMACJA_STATUS.DONE) {
      return "success";
    }

    if (
      [
        REKLAMACJA_STATUS.NEW,
        REKLAMACJA_STATUS.UPDATED,
        REKLAMACJA_STATUS.IN_PROGRESS,
        REKLAMACJA_STATUS.ROUTE_PLANNED,
        REKLAMACJA_STATUS.ON_ROUTE,
      ].includes(nextStatus)
    ) {
      return "info";
    }

    return "neutral";
  }

  if (DANGER_OPERATIONAL_LOG_ACTIONS.has(action)) {
    return "danger";
  }

  if (SUCCESS_OPERATIONAL_LOG_ACTIONS.has(action)) {
    return "success";
  }

  if (WARNING_OPERATIONAL_LOG_ACTIONS.has(action)) {
    return "warning";
  }

  if (INFO_OPERATIONAL_LOG_ACTIONS.has(action)) {
    return "info";
  }

  return "neutral";
}

export function formatOperationalLogAction(log) {
  const fallback = labelForOperationalAction(log?.action);
  const routeSuffix = formatRouteSuffix(log);

  switch (log?.action) {
    case "route_started":
      return formatActionWithOptionalDate(
        `Wystartowano trase${routeSuffix}`,
        log?.after_state?.started_at || log?.created_at
      );
    case "route_stop_started":
      return formatActionWithOptionalDate(
        `Rozpoczeto obsluge punktu${routeSuffix}`,
        log?.after_state?.started_at || log?.created_at
      );
    case "route_delivered":
      return formatActionWithOptionalDate(
        `Dostarczono do klienta${routeSuffix}`,
        log?.after_state?.data_zakonczenia ||
          log?.after_state?.delivered_at ||
          log?.created_at
      );
    case "route_stop_delivered":
      return formatActionWithOptionalDate(
        `Oznaczono punkt jako dostarczony${routeSuffix}`,
        log?.after_state?.delivered_at ||
          log?.after_state?.data_zakonczenia ||
          log?.created_at
      );
    case "route_undelivered":
    case "route_stop_undelivered":
      return formatActionWithOptionalDate(
        `Oznaczono jako oczekuje na dostawe${routeSuffix}`,
        log?.created_at
      );
    case "reklamacja_waiting_delivery":
      return formatActionWithOptionalDate(
        "Oznaczono jako oczekuje na dostawe",
        log?.created_at
      );
    case "reklamacja_realizacja_do_updated_from_sms_confirmation": {
      const beforeDate =
        formatLogDate(log?.metadata?.previous_realizacja_do, false) ||
        formatLogDate(log?.before_state?.realizacja_do, false);
      const afterDate =
        formatLogDate(log?.metadata?.next_realizacja_do, false) ||
        formatLogDate(log?.after_state?.realizacja_do, false) ||
        formatLogDate(log?.metadata?.eta_from, false);

      if (!beforeDate || !afterDate) {
        return fallback;
      }

      return `Zmieniono termin realizacji po potwierdzeniu SMS z ${beforeDate} na ${afterDate}`;
    }
    case "route_sms_confirmation_status_changed_manual": {
      const statusChange = getLogStatusChange(
        log,
        "sms_potwierdzenie_status",
        "sms_potwierdzenie_status"
      );

      if (!statusChange) {
        return fallback;
      }

      return `Zmieniono status lampki SMS z ${statusChange.before} na ${statusChange.after}`;
    }
    case "reklamacja_status_changed_manual": {
      const statusChange = getLogStatusChange(log, "status", "status");

      if (!statusChange) {
        return fallback;
      }

      return `Zmieniono status reklamacji z ${statusChange.before} na ${statusChange.after}`;
    }
    default:
      return fallback;
  }
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

  const fromDateRaw = new Date(etaFrom);
  if (Number.isNaN(fromDateRaw.getTime())) {
    return "-";
  }

  const fromDate =
    roundDateValueToNearestMinutes(fromDateRaw, 30) || fromDateRaw;

  const fromDatePart = new Intl.DateTimeFormat("pl-PL", {
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
    return `${fromDatePart} ${fromTime}`;
  }

  const toDateRaw = new Date(etaTo);
  if (Number.isNaN(toDateRaw.getTime())) {
    return `${fromDatePart} ${fromTime}`;
  }

  const toDate = roundDateValueToNearestMinutes(toDateRaw, 30) || toDateRaw;

  const toDatePart = new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(toDate);

  const toTime = new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Warsaw",
  }).format(toDate);

  if (toDatePart !== fromDatePart) {
    return `${fromDatePart} ${fromTime}-${toDatePart} ${toTime}`;
  }

  return `${fromDatePart} ${fromTime}-${toTime}`;
}

export function getRouteDisplayName(route) {
  return route?.nazwa || route?.numer || "Trasa";
}

function cleanText(value) {
  return value == null ? "" : String(value).trim();
}

export function getRouteStopComplaint(stop = {}) {
  const routeStop = stop || {};
  const nestedComplaint =
    routeStop?.reklamacje && typeof routeStop.reklamacje === "object"
      ? routeStop.reklamacje
      : {};

  const field = (key) => {
    const value = routeStop?.[key];
    return value == null || value === "" ? nestedComplaint?.[key] ?? "" : value;
  };
  const nullableField = (key) => {
    const value =
      routeStop?.[key] == null || routeStop?.[key] === ""
        ? nestedComplaint?.[key] ?? null
        : routeStop[key];
    return value === "" ? null : value;
  };

  return {
    ...nestedComplaint,
    id: nestedComplaint?.id ?? routeStop?.reklamacja_id ?? routeStop?.id ?? null,
    reklamacja_id:
      routeStop?.reklamacja_id ?? nestedComplaint?.id ?? routeStop?.id ?? null,
    nr_reklamacji: field("nr_reklamacji"),
    numer_faktury: field("numer_faktury"),
    nazwa_firmy: field("nazwa_firmy"),
    nazwa_mebla: field("nazwa_mebla"),
    imie_klienta: field("imie_klienta"),
    nazwisko_klienta: field("nazwisko_klienta"),
    telefon_klienta: field("telefon_klienta"),
    kod_pocztowy: field("kod_pocztowy"),
    miejscowosc: field("miejscowosc"),
    adres: field("adres"),
    lat: nullableField("lat"),
    lon: nullableField("lon"),
    opis: field("opis"),
    status:
      nestedComplaint?.status ??
      routeStop?.reklamacja_status ??
      (routeStop?.reklamacje ? null : routeStop?.status),
  };
}

export function formatRouteStopAddress(stopOrComplaint = {}) {
  const complaint = stopOrComplaint?.reklamacje
    ? getRouteStopComplaint(stopOrComplaint)
    : stopOrComplaint || {};
  const postalTown = [
    cleanText(complaint.kod_pocztowy),
    cleanText(complaint.miejscowosc),
  ]
    .filter(Boolean)
    .join(" ");
  const address = cleanText(complaint.adres);

  return [postalTown, address].filter(Boolean).join(", ");
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

export const APP_NAME = "Meblofix Sp. z o.o.";

export const REKLAMACJA_STATUS = {
  NEW: "Zgłoszone",
  UPDATED: "Zaktualizowano",
  WAITING_INFO: "Oczekuje na informacje",
  WAITING_DELIVERY: "Oczekuje na dostawę",
  IN_PROGRESS: "W trakcie realizacji",
  ROUTE_PLANNED: "Zaplanowano trasę",
  ON_ROUTE: "W trasie",
  DONE: "Zakończone",
  ARCHIVE: "Archiwum",
};

export const REKLAMACJA_STATUS_LABELS = {
  [REKLAMACJA_STATUS.NEW]: "Zgłoszone",
  [REKLAMACJA_STATUS.UPDATED]: "Zaktualizowano",
  [REKLAMACJA_STATUS.WAITING_INFO]: "Oczekuje na informacje",
  [REKLAMACJA_STATUS.WAITING_DELIVERY]: "Oczekuje na dostawę",
  [REKLAMACJA_STATUS.IN_PROGRESS]: "W trakcie realizacji",
  [REKLAMACJA_STATUS.ROUTE_PLANNED]: "Zaplanowano trasę",
  [REKLAMACJA_STATUS.ON_ROUTE]: "W trasie",
  [REKLAMACJA_STATUS.DONE]: "Zakończone",
  [REKLAMACJA_STATUS.ARCHIVE]: "Archiwum",
};

export const ACTIVE_REKLAMACJA_STATUSES = [
  REKLAMACJA_STATUS.NEW,
  REKLAMACJA_STATUS.UPDATED,
  REKLAMACJA_STATUS.WAITING_INFO,
  REKLAMACJA_STATUS.WAITING_DELIVERY,
  REKLAMACJA_STATUS.IN_PROGRESS,
  REKLAMACJA_STATUS.ROUTE_PLANNED,
  REKLAMACJA_STATUS.ON_ROUTE,
];

export const ARCHIVE_STATUSES = [
  REKLAMACJA_STATUS.DONE,
  REKLAMACJA_STATUS.ARCHIVE,
];

export const ROUTE_CANDIDATE_STATUSES = [
  REKLAMACJA_STATUS.NEW,
  REKLAMACJA_STATUS.UPDATED,
  REKLAMACJA_STATUS.IN_PROGRESS,
  REKLAMACJA_STATUS.WAITING_DELIVERY,
];

export const ROUTE_STATUS = {
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export const ROUTE_STATUS_LABELS = {
  [ROUTE_STATUS.PLANNED]: "Zaplanowana",
  [ROUTE_STATUS.IN_PROGRESS]: "W trasie",
  [ROUTE_STATUS.COMPLETED]: "Ukończona",
  [ROUTE_STATUS.CANCELLED]: "Anulowana",
};

export const ROUTE_STOP_STATUS = {
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  DELIVERED: "delivered",
};

export const ROUTE_STOP_STATUS_LABELS = {
  [ROUTE_STOP_STATUS.PLANNED]: "Zaplanowany",
  [ROUTE_STOP_STATUS.IN_PROGRESS]: "W realizacji",
  [ROUTE_STOP_STATUS.DELIVERED]: "Dostarczony",
};

export const ROLE = {
  ADMIN: "admin",
  USER: "uzytkownik",
};

export const DEFAULT_OPERATIONAL_SETTINGS = {
  domyslny_czas_obslugi_min: 30,
  szerokosc_okna_min: 60,
};

export const STATUS_BADGE_STYLES = {
  [REKLAMACJA_STATUS.NEW]:
    "bg-amber-100 text-amber-900 border border-amber-200",
  [REKLAMACJA_STATUS.UPDATED]:
    "bg-orange-100 text-orange-900 border border-orange-200",
  [REKLAMACJA_STATUS.WAITING_INFO]:
    "bg-red-100 text-red-900 border border-red-200",
  [REKLAMACJA_STATUS.WAITING_DELIVERY]:
    "bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-200",
  [REKLAMACJA_STATUS.IN_PROGRESS]:
    "bg-sky-100 text-sky-900 border border-sky-200",
  [REKLAMACJA_STATUS.ROUTE_PLANNED]:
    "bg-indigo-100 text-indigo-900 border border-indigo-200",
  [REKLAMACJA_STATUS.ON_ROUTE]:
    "bg-violet-100 text-violet-900 border border-violet-200",
  [REKLAMACJA_STATUS.DONE]:
    "bg-emerald-100 text-emerald-900 border border-emerald-200",
  [REKLAMACJA_STATUS.ARCHIVE]:
    "bg-slate-100 text-slate-700 border border-slate-200",
  [ROUTE_STATUS.PLANNED]:
    "bg-slate-100 text-slate-800 border border-slate-200",
  [ROUTE_STATUS.IN_PROGRESS]:
    "bg-indigo-100 text-indigo-900 border border-indigo-200",
  [ROUTE_STATUS.COMPLETED]:
    "bg-emerald-100 text-emerald-900 border border-emerald-200",
  [ROUTE_STATUS.CANCELLED]:
    "bg-rose-100 text-rose-900 border border-rose-200",
  [ROUTE_STOP_STATUS.PLANNED]:
    "bg-slate-100 text-slate-800 border border-slate-200",
  [ROUTE_STOP_STATUS.IN_PROGRESS]:
    "bg-indigo-100 text-indigo-900 border border-indigo-200",
  [ROUTE_STOP_STATUS.DELIVERED]:
    "bg-emerald-100 text-emerald-900 border border-emerald-200",
};

export const STORAGE_BUCKET = "reklamacje";

export const STORAGE_PUBLIC_PREFIX = "/storage/v1/object/public";

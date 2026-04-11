export const APP_NAME = "Meblofix Sp. z o.o.";

export const REKLAMACJA_STATUS = {
  NEW: "Zg\u0142oszone",
  UPDATED: "Zaktualizowano",
  IN_PROGRESS: "W trakcie realizacji",
  WAITING_INFO: "Oczekuje na informacje",
  WAITING_DELIVERY: "Oczekuje na dostaw\u0119",
  ROUTE_PLANNED: "Zaplanowano tras\u0119",
  ON_ROUTE: "W trasie",
  DONE: "Zako\u0144czone",
  ARCHIVE: "Archiwum",
};

export const REKLAMACJA_STATUS_LABELS = {
  [REKLAMACJA_STATUS.NEW]: "Zg\u0142oszone",
  [REKLAMACJA_STATUS.UPDATED]: "Zaktualizowano",
  [REKLAMACJA_STATUS.IN_PROGRESS]: "W trakcie realizacji",
  [REKLAMACJA_STATUS.WAITING_INFO]: "Oczekuje na informacje",
  [REKLAMACJA_STATUS.WAITING_DELIVERY]: "Oczekuje na dostaw\u0119",
  [REKLAMACJA_STATUS.ROUTE_PLANNED]: "Zaplanowano tras\u0119",
  [REKLAMACJA_STATUS.ON_ROUTE]: "W trasie",
  [REKLAMACJA_STATUS.DONE]: "Zako\u0144czone",
  [REKLAMACJA_STATUS.ARCHIVE]: "Archiwum",
};

export const REKLAMACJA_STATUS_OPTIONS = [
  REKLAMACJA_STATUS.NEW,
  REKLAMACJA_STATUS.UPDATED,
  REKLAMACJA_STATUS.IN_PROGRESS,
  REKLAMACJA_STATUS.WAITING_DELIVERY,
  REKLAMACJA_STATUS.ROUTE_PLANNED,
  REKLAMACJA_STATUS.ON_ROUTE,
  REKLAMACJA_STATUS.DONE,
  REKLAMACJA_STATUS.ARCHIVE,
];

export const ACTIVE_REKLAMACJA_STATUSES = [
  REKLAMACJA_STATUS.NEW,
  REKLAMACJA_STATUS.UPDATED,
  REKLAMACJA_STATUS.IN_PROGRESS,
  REKLAMACJA_STATUS.WAITING_DELIVERY,
  REKLAMACJA_STATUS.ROUTE_PLANNED,
  REKLAMACJA_STATUS.ON_ROUTE,
];

export const ACCEPTABLE_REKLAMACJA_STATUSES = [
  REKLAMACJA_STATUS.NEW,
  REKLAMACJA_STATUS.UPDATED,
];

export const MANUAL_REKLAMACJA_DISABLED_STATUSES = [
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
  [ROUTE_STATUS.COMPLETED]: "Uko\u0144czona",
  [ROUTE_STATUS.CANCELLED]: "Anulowana",
};

export const ROUTE_STOP_STATUS = {
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  DELIVERED: "delivered",
  UNDELIVERED: "undelivered",
};

export const ROUTE_STOP_STATUS_LABELS = {
  [ROUTE_STOP_STATUS.PLANNED]: "Zaplanowany",
  [ROUTE_STOP_STATUS.IN_PROGRESS]: "W realizacji",
  [ROUTE_STOP_STATUS.DELIVERED]: "Dostarczony",
  [ROUTE_STOP_STATUS.UNDELIVERED]: "Niedostarczony",
};

export const ROUTE_STOP_FINAL_STATUSES = [
  ROUTE_STOP_STATUS.DELIVERED,
  ROUTE_STOP_STATUS.UNDELIVERED,
];

export const SMS_CONFIRMATION_STATUS = {
  NOT_SENT: "not_sent",
  SENT: "sent",
  CONFIRMED: "confirmed",
  MANUAL_REJECTED: "manual_rejected",
};

export const SMS_CONFIRMATION_STATUS_LABELS = {
  [SMS_CONFIRMATION_STATUS.NOT_SENT]: "Niewyslane",
  [SMS_CONFIRMATION_STATUS.SENT]: "Wyslane",
  [SMS_CONFIRMATION_STATUS.CONFIRMED]: "Potwierdzone",
  [SMS_CONFIRMATION_STATUS.MANUAL_REJECTED]: "Odrzucone recznie",
};

export const OPERATIONAL_LOG_ACTION_LABELS = {
  reklamacja_created: "Utworzono reklamacje",
  reklamacja_updated: "Zaktualizowano reklamacje",
  reklamacja_accepted: "Przyjeto reklamacje do realizacji",
  reklamacja_waiting_info: "Ustawiono oczekiwanie na informacje",
  reklamacja_waiting_delivery: "Ustawiono oczekiwanie na dostawe",
  reklamacja_element_odebrany_updated: "Zmieniono stan elementu odebranego",
  reklamacja_closed_manual: "Zakonczono reklamacje",
  reklamacja_close_data_updated: "Zaktualizowano dane zakonczenia",
  reklamacja_status_changed_manual: "Recznie zmieniono status reklamacji",
  reklamacja_archived_manual: "Przeniesiono reklamacje do archiwum",
  reklamacja_archived_auto: "Automatycznie przeniesiono reklamacje do archiwum",
  reklamacja_acknowledged: "Potwierdzono zapoznanie z reklamacja",
  route_created: "Utworzono trase",
  route_recalculated: "Przeliczono trase",
  route_started: "Rozpoczeto trase",
  route_completed: "Zakonczono trase",
  route_assigned: "Przypisano reklamacje do trasy",
  route_unassigned: "Usunieto reklamacje z trasy",
  route_delivered: "Dostarczono reklamacje na trasie",
  route_undelivered: "Nie dostarczono reklamacji na trasie",
  route_stop_created: "Dodano punkt do trasy",
  route_stop_removed: "Usunieto punkt z trasy",
  route_stop_started: "Rozpoczeto obsluge punktu",
  route_stop_delivered: "Oznaczono punkt jako dostarczony",
  route_stop_undelivered: "Oznaczono punkt jako niedostarczony",
  route_sms_confirmation_batch_sent: "Wyslano zbiorcze SMS potwierdzen ETA",
  route_sms_confirmation_sent: "Wyslano SMS potwierdzenia ETA",
  route_sms_confirmation_reset: "Zresetowano potwierdzenie SMS",
  route_sms_confirmation_confirmed: "Klient potwierdzil termin z SMS",
  route_sms_confirmation_call_clicked: "Klient kliknal kontakt telefoniczny z SMS",
  route_sms_confirmation_status_changed_manual:
    "Recznie zmieniono status lampki SMS",
  route_sms_start_sent: "Wyslano SMS o starcie trasy",
  route_sms_send_failed: "Nie udalo sie wyslac SMS",
};

export const ROLE = {
  ADMIN: "admin",
  USER: "uzytkownik",
};

export const DEFAULT_OPERATIONAL_SETTINGS = {
  domyslny_czas_obslugi_min: 30,
  szerokosc_okna_min: 60,
  sms_kontakt_telefon: "",
  sms_szablon_potwierdzenia:
    "Twoja reklamacja zostala zaplanowana na {{okno}}, prosimy o potwierdzenie pod linkiem {{link}} lub kontakt {{telefon}}",
  sms_szablon_startu_trasy:
    "Zaplanowana reklamacja wyruszyla w trase. Termin: {{okno}}. Pozdrawiamy, Meblofix",
};

export const STATUS_BADGE_STYLES = {
  [REKLAMACJA_STATUS.NEW]:
    "bg-amber-100 text-amber-900 border border-amber-200",
  [REKLAMACJA_STATUS.UPDATED]:
    "bg-orange-100 text-orange-900 border border-orange-200",
  [REKLAMACJA_STATUS.IN_PROGRESS]:
    "bg-red-100 text-red-900 border border-red-200",
  [REKLAMACJA_STATUS.WAITING_INFO]:
    "bg-red-100 text-red-900 border border-red-200",
  [REKLAMACJA_STATUS.WAITING_DELIVERY]:
    "bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-200",
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
  [ROUTE_STOP_STATUS.UNDELIVERED]:
    "bg-rose-100 text-rose-900 border border-rose-200",
};

export const STORAGE_BUCKET = "reklamacje";

export const STORAGE_PUBLIC_PREFIX = "/storage/v1/object/public";

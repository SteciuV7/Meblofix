import { AppShell } from "@/components/layout/AppShell";
import PickedUpIndicator from "@/components/PickedUpIndicator";
import { ScreenState } from "@/components/layout/ScreenState";
import { StatusBadge } from "@/components/StatusBadge";
import ComplaintAcceptModal from "@/components/reklamacje/ComplaintAcceptModal";
import ComplaintAddressPreviewModal from "@/components/reklamacje/ComplaintAddressPreviewModal";
import ComplaintChangesAcknowledgeModal from "@/components/reklamacje/ComplaintChangesAcknowledgeModal";
import ComplaintCloseModal from "@/components/reklamacje/ComplaintCloseModal";
import ImagePreviewModal from "@/components/reklamacje/ImagePreviewModal";
import ComplaintSmsRejectionModal from "@/components/reklamacje/ComplaintSmsRejectionModal";
import StoredImageTile from "@/components/reklamacje/StoredImageTile";
import RouteSmsStatusControl from "@/components/trasy/RouteSmsStatusControl";
import { storagePathToFileName } from "@/components/reklamacje/AttachmentDropzone";
import {
  ACCEPTABLE_REKLAMACJA_STATUSES,
  REKLAMACJA_STATUS,
  ROLE,
  SMS_CONFIRMATION_STATUS,
} from "@/lib/constants";
import { apiFetch } from "@/lib/client-api";
import { getPublicStorageUrl } from "@/lib/storage";
import { useCurrentProfile } from "@/lib/use-current-profile";
import {
  cn,
  formatDate,
  formatDistance,
  formatDuration,
  formatEtaDate,
  formatOperationalLogAction,
  getOperationalLogTone,
  getComplaintCustomerName,
  getPhoneHref,
  getRouteDisplayName,
  safeArray,
} from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const MAX_FURNITURE_NAME_LENGTH = 15;

function toDateInputValue(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}

const OPERATIONAL_LOG_ROW_STYLES = {
  danger: "border-t border-l-4 border-l-rose-400 border-t-rose-100 bg-rose-50/80",
  success:
    "border-t border-l-4 border-l-emerald-400 border-t-emerald-100 bg-emerald-50/80",
  warning:
    "border-t border-l-4 border-l-amber-400 border-t-amber-100 bg-amber-50/80",
  info: "border-t border-l-4 border-l-sky-300 border-t-sky-100 bg-sky-50/70",
  neutral: "border-t border-slate-200",
};

function buildEditState(detail) {
  return {
    numer_faktury: detail?.reklamacja?.numer_faktury || "",
    nazwa_mebla: detail?.reklamacja?.nazwa_mebla || "",
    imie_klienta: detail?.reklamacja?.imie_klienta || "",
    nazwisko_klienta: detail?.reklamacja?.nazwisko_klienta || "",
    telefon_klienta: detail?.reklamacja?.telefon_klienta || "",
    kod_pocztowy: detail?.reklamacja?.kod_pocztowy || "",
    miejscowosc: detail?.reklamacja?.miejscowosc || "",
    adres: detail?.reklamacja?.adres || "",
    opis: detail?.reklamacja?.opis || "",
    informacje_od_zglaszajacego:
      detail?.reklamacja?.informacje_od_zglaszajacego || "",
    informacje: detail?.reklamacja?.informacje || "",
    realizacja_do: detail?.reklamacja?.realizacja_do
      ? new Date(detail.reklamacja.realizacja_do).toISOString().slice(0, 16)
      : "",
  };
}

function buildRequestedAddress(form) {
  return {
    addressLine: form.adres,
    postalCode: form.kod_pocztowy,
    town: form.miejscowosc,
  };
}

function normalizeAddressPart(value) {
  return String(value || "").trim();
}

function hasCompletionData(reklamacja) {
  return Boolean(
    reklamacja?.data_zakonczenia ||
      reklamacja?.opis_przebiegu?.trim() ||
      reklamacja?.zalacznik_pdf_zakonczenie ||
      safeArray(reklamacja?.zalacznik_zakonczenie).length
  );
}

function DetailCard({ actions, children, title }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function formatLogActor(log, viewerRole) {
  if (viewerRole === ROLE.ADMIN) {
    return {
      name: log.actor_email || "system",
      role: log.actor_role || null,
    };
  }

  if (log.actor_role === ROLE.ADMIN) {
    return {
      name: "Meblofix",
      role: null,
    };
  }

  if (log.actor_role === "public") {
    return {
      name: "Link SMS klienta",
      role: null,
    };
  }

  if (log.actor_role === ROLE.USER) {
    return {
      name: log.actor_email || "Uzytkownik",
      role: null,
    };
  }

  return {
    name: log.actor_email || "System",
    role: null,
  };
}

function formatTooltipDatePart(date) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(date);
}

function formatTooltipTimePart(date) {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Warsaw",
  }).format(date);
}

function formatSmsTooltipWindow(routeStop, reklamacja, withTime = true) {
  const etaFrom = routeStop?.eta_from || routeStop?.etaFrom || null;
  const etaTo = routeStop?.eta_to || routeStop?.etaTo || null;

  if (etaFrom) {
    const fromDate = new Date(etaFrom);

    if (!Number.isNaN(fromDate.getTime())) {
      const fromDatePart = formatTooltipDatePart(fromDate);

      if (!withTime) {
        if (!etaTo) {
          return fromDatePart;
        }

        const toDate = new Date(etaTo);
        if (Number.isNaN(toDate.getTime())) {
          return fromDatePart;
        }

        const toDatePart = formatTooltipDatePart(toDate);
        return toDatePart !== fromDatePart
          ? `${fromDatePart}-${toDatePart}`
          : fromDatePart;
      }

      const fromTime = formatTooltipTimePart(fromDate);

      if (!etaTo) {
        return `${fromDatePart} ${fromTime}`;
      }

      const toDate = new Date(etaTo);
      if (Number.isNaN(toDate.getTime())) {
        return `${fromDatePart} ${fromTime}`;
      }

      const toDatePart = formatTooltipDatePart(toDate);
      const toTime = formatTooltipTimePart(toDate);

      if (toDatePart !== fromDatePart) {
        return `${fromDatePart} ${fromTime}-${toDatePart} ${toTime}`;
      }

      return `${fromDatePart} ${fromTime}-${toTime}`;
    }
  }

  const fallbackDate = formatDate(reklamacja?.realizacja_do, withTime);
  return fallbackDate === "-" ? "" : fallbackDate;
}

function buildSmsConfirmationDisplay(reklamacja, routeStop, status, withTime = true) {
  const activeStatus = status || SMS_CONFIRMATION_STATUS.NOT_SENT;
  const windowLabel = formatSmsTooltipWindow(routeStop, reklamacja, withTime);
  const termSuffix = windowLabel ? ` ${windowLabel}` : "";

  if (!routeStop || activeStatus === SMS_CONFIRMATION_STATUS.NOT_SENT) {
    return {
      status: SMS_CONFIRMATION_STATUS.NOT_SENT,
      tooltipLabel:
        "Termin realizacji nie został jeszcze zaproponowany klientowi - reklamacja oczekuje na zaplanowanie do trasy",
    };
  }

  if (activeStatus === SMS_CONFIRMATION_STATUS.CONFIRMED) {
    return {
      status: SMS_CONFIRMATION_STATUS.CONFIRMED,
      tooltipLabel: `Klient potwierdził termin${termSuffix}`,
    };
  }

  if (activeStatus === SMS_CONFIRMATION_STATUS.MANUAL_REJECTED) {
    return {
      status: SMS_CONFIRMATION_STATUS.SENT,
      tooltipLabel: `Klient odrzucił proponowany termin${termSuffix}`,
    };
  }

  if (activeStatus === SMS_CONFIRMATION_STATUS.SENT) {
    return {
      status: SMS_CONFIRMATION_STATUS.SENT,
      tooltipLabel: `Meblofix zaproponował klientowi termin${termSuffix}. Oczekuje na potwierdzenie`,
    };
  }

  return {
    status: activeStatus,
    tooltipLabel: "",
  };
}

const EMPTY_PENDING_USER_CHANGES = {
  hasChanges: false,
  events: [],
};

export default function ReklamacjaDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { profile, loading, error } = useCurrentProfile();
  const [detail, setDetail] = useState(null);
  const [editState, setEditState] = useState(buildEditState(null));
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFurnitureError, setEditFurnitureError] = useState("");
  const [editReporterInfoError, setEditReporterInfoError] = useState("");
  const [editDeadlineError, setEditDeadlineError] = useState("");
  const [addressPreview, setAddressPreview] = useState(null);
  const [previewingAddress, setPreviewingAddress] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [changesModalDismissedForId, setChangesModalDismissedForId] =
    useState(null);
  const [acknowledgingSmsRejection, setAcknowledgingSmsRejection] =
    useState(false);
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [closeModalMode, setCloseModalMode] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (error) {
      router.push("/login");
    }
  }, [error, router]);

  useEffect(() => {
    if (!profile || !id) return;

    let active = true;

    async function load() {
      try {
        const response = await apiFetch(`/api/reklamacje/${id}`);
        if (!active) return;
        setDetail(response);
        setEditState(buildEditState(response));
        setLoadError(null);
      } catch (err) {
        if (!active) return;
        setLoadError(err.message || "Nie udalo sie pobrac reklamacji.");
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [profile, id]);

  useEffect(() => {
    setChangesModalDismissedForId(null);
  }, [id]);

  useEffect(() => {
    if (!addressPreview || saving) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setAddressPreview(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [addressPreview, saving]);

  const images = useMemo(
    () => safeArray(detail?.reklamacja?.zalacznik_zdjecia),
    [detail?.reklamacja?.zalacznik_zdjecia]
  );
  const completionImages = useMemo(
    () => safeArray(detail?.reklamacja?.zalacznik_zakonczenie),
    [detail?.reklamacja?.zalacznik_zakonczenie]
  );
  const completionVisible = hasCompletionData(detail?.reklamacja);
  const complaintClosed =
    detail?.reklamacja?.status === REKLAMACJA_STATUS.DONE ||
    Boolean(detail?.reklamacja?.data_zakonczenia);
  const customerName = getComplaintCustomerName(detail?.reklamacja);
  const customerPhoneHref = getPhoneHref(detail?.reklamacja?.telefon_klienta);
  const manualStatusChangeBlocked = Boolean(detail?.activeRouteStop);
  const blockingRoute = detail?.activeRouteStop?.trasy || null;
  const canAcceptCurrentComplaint =
    profile?.role === ROLE.ADMIN &&
    ACCEPTABLE_REKLAMACJA_STATUSES.includes(detail?.reklamacja?.status) &&
    !manualStatusChangeBlocked;
  const isElementPickedUp = Boolean(detail?.reklamacja?.element_odebrany);
  const complaintDisplayNumber =
    detail?.reklamacja?.numer_faktury ||
    detail?.reklamacja?.nr_reklamacji ||
    "-";
  const showServiceTimes = profile?.role === ROLE.ADMIN;
  const routeStopSmsStatus =
    detail?.routeStop?.smsConfirmationStatus ||
    detail?.routeStop?.sms_potwierdzenie_status;
  const smsConfirmationDisplay = buildSmsConfirmationDisplay(
    detail?.reklamacja,
    detail?.routeStop,
    routeStopSmsStatus,
    showServiceTimes
  );
  const routeStopStatus = detail?.routeStop?.status || null;
  const pendingUserChanges =
    detail?.pendingUserChanges || EMPTY_PENDING_USER_CHANGES;
  const pendingSmsRejectionAlert = detail?.pendingSmsRejectionAlert || {
    hasAlert: false,
    message: null,
    eventDate: null,
    logId: null,
  };
  const userAddressEditBlocked =
    profile?.role !== ROLE.ADMIN &&
    (routeStopStatus === "in_progress" ||
      (routeStopStatus === "planned" &&
        routeStopSmsStatus === SMS_CONFIRMATION_STATUS.CONFIRMED));
  const filteredPendingUserChanges = useMemo(() => {
    if (profile?.role === ROLE.ADMIN) {
      return pendingUserChanges;
    }

    const events = safeArray(pendingUserChanges?.events)
      .map((event) => ({
        ...event,
        changes: safeArray(event?.changes).filter(
          (change) => change?.fieldLabel !== "Element odebrany"
        ),
      }))
      .filter((event) => event.changes.length > 0);

    return {
      ...pendingUserChanges,
      hasChanges: events.length > 0,
      events,
    };
  }, [pendingUserChanges, profile?.role]);
  const showAdminSections = profile?.role === ROLE.ADMIN;
  const showSmsRejectionAlert =
    profile?.role !== ROLE.ADMIN && pendingSmsRejectionAlert.hasAlert;
  const showChangesAcknowledgeModal =
    profile?.role !== ROLE.ADMIN &&
    detail?.reklamacja?.nieprzeczytane_dla_uzytkownika &&
    filteredPendingUserChanges.hasChanges &&
    !showSmsRejectionAlert &&
    changesModalDismissedForId !== detail?.reklamacja?.id;
  const hasAsideContent = showAdminSections;

  async function refresh() {
    const response = await apiFetch(`/api/reklamacje/${id}`);
    setDetail(response);
    setEditState(buildEditState(response));
    setLoadError(null);
  }

  async function update(action, payload = {}) {
    try {
      setSaving(true);
      await apiFetch(`/api/reklamacje/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, payload }),
      });
      await refresh();
      return true;
    } catch (err) {
      alert(err.message || "Nie udalo sie wykonac operacji.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function validateEditState() {
    const nazwaMebla = editState.nazwa_mebla.trim();
    let hasErrors = false;

    if (!nazwaMebla) {
      setEditFurnitureError("Nazwa mebla jest wymagana.");
      hasErrors = true;
    } else if (nazwaMebla.length > MAX_FURNITURE_NAME_LENGTH) {
      setEditFurnitureError(
        `Nazwa mebla moze miec maksymalnie ${MAX_FURNITURE_NAME_LENGTH} znakow.`
      );
      hasErrors = true;
    } else {
      setEditFurnitureError("");
    }

    if (!editState.informacje_od_zglaszajacego.trim()) {
      setEditReporterInfoError("Informacje od zglaszajacego sa wymagane.");
      hasErrors = true;
    } else {
      setEditReporterInfoError("");
    }

    if (!editState.realizacja_do) {
      setEditDeadlineError("Termin realizacji jest wymagany.");
      hasErrors = true;
    } else {
      setEditDeadlineError("");
    }

    return !hasErrors;
  }

  function buildEditPayload(extra = {}) {
    return {
      ...editState,
      ...extra,
      realizacja_do: editState.realizacja_do
        ? new Date(editState.realizacja_do).toISOString()
        : null,
    };
  }

  function hasAddressChanged() {
    const reklamacja = detail?.reklamacja || {};

    return (
      normalizeAddressPart(editState.adres) !==
        normalizeAddressPart(reklamacja.adres) ||
      normalizeAddressPart(editState.miejscowosc) !==
        normalizeAddressPart(reklamacja.miejscowosc) ||
      normalizeAddressPart(editState.kod_pocztowy) !==
        normalizeAddressPart(reklamacja.kod_pocztowy)
    );
  }

  async function saveEditPayload(payload, { showAlert = true } = {}) {
    try {
      setSaving(true);
      await apiFetch(`/api/reklamacje/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "update", payload }),
      });
      await refresh();
      setIsEditing(false);
      return { ok: true };
    } catch (err) {
      const message = err.message || "Nie udalo sie wykonac operacji.";
      if (showAlert) {
        alert(message);
      }
      return { ok: false, message };
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!validateEditState()) {
      return;
    }

    if (!hasAddressChanged()) {
      await saveEditPayload(buildEditPayload());
      return;
    }

    try {
      setPreviewingAddress(true);
      const preview = await apiFetch("/api/reklamacje/geocode-preview", {
        method: "POST",
        body: JSON.stringify(buildEditPayload()),
      });

      setAddressPreview({
        ...preview,
        kind: "geocode",
        submitError: "",
      });
    } catch (err) {
      setAddressPreview({
        kind: "error",
        requestedAddress: buildRequestedAddress(editState),
        message: err.message || "Nie udalo sie sprawdzic adresu.",
      });
    } finally {
      setPreviewingAddress(false);
    }
  }

  async function handleConfirmAddress() {
    if (!addressPreview || !validateEditState()) {
      return;
    }

    const result = await saveEditPayload(
      buildEditPayload({
        addressApprovalMode: addressPreview.geocode?.matchType || "exact",
        addressGeocode: addressPreview.geocode || null,
      }),
      { showAlert: false }
    );

    if (result.ok) {
      setAddressPreview(null);
      return;
    }

    setAddressPreview((current) =>
      current
        ? {
            ...current,
            submitError: result.message || "Nie udalo sie zapisac zmian reklamacji.",
          }
        : current
    );
  }

  async function handleCloseSubmit(payload) {
    setSaving(true);

    try {
      await apiFetch(`/api/reklamacje/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action:
            closeModalMode === "edit" || closeModalMode === "edit-date"
              ? "update-close-data"
              : "close",
          payload,
        }),
      });
      setCloseModalMode(null);
      await refresh();
      setIsEditing(false);
    } catch (error) {
      throw error;
    } finally {
      setSaving(false);
    }
  }

  function handleToggleEditing() {
    if (isEditing) {
      setEditState(buildEditState(detail));
      setEditFurnitureError("");
      setEditReporterInfoError("");
      setEditDeadlineError("");
      setAddressPreview(null);
      setIsEditing(false);
      return;
    }

    setEditFurnitureError("");
    setEditReporterInfoError("");
    setEditDeadlineError("");
    setAddressPreview(null);
    setIsEditing(true);
  }

  async function handleAcknowledge() {
    try {
      setSaving(true);
      await apiFetch(`/api/reklamacje/${id}/acknowledge`, {
        method: "POST",
      });
      setChangesModalDismissedForId(detail?.reklamacja?.id || id);
      await refresh();
    } catch (err) {
      alert(err.message || "Nie udalo sie potwierdzic odczytu.");
    } finally {
      setSaving(false);
    }
  }

  function handleDismissChangesModal() {
    setChangesModalDismissedForId(detail?.reklamacja?.id || id);
  }

  async function handleAcknowledgeSmsRejectionAlert() {
    try {
      setAcknowledgingSmsRejection(true);
      await apiFetch(`/api/reklamacje/${id}/sms-rejection-acknowledge`, {
        method: "POST",
      });
      await refresh();
    } catch (err) {
      alert(err.message || "Nie udalo sie potwierdzic informacji o odmowie.");
    } finally {
      setAcknowledgingSmsRejection(false);
    }
  }

  async function handleAcceptSubmit(payload) {
    const success = await update("accept", payload);

    if (success) {
      setAcceptModalOpen(false);
    }
  }

  async function handleTogglePickedUp() {
    await update("set-element-odebrany", {
      element_odebrany: !isElementPickedUp,
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        Ladowanie...
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <>
      <AppShell
        profile={profile}
        title={`Reklamacja ${complaintDisplayNumber !== "-" ? complaintDisplayNumber : ""}`}
        subtitle="Pelny szczegol zgloszenia z historia zmian, informacja o trasie i danymi zakonczenia."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/reklamacje"
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Wroc do listy
            </Link>
            {canAcceptCurrentComplaint ? (
              <button
                type="button"
                onClick={() => setAcceptModalOpen(true)}
                disabled={saving}
                className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Przyjmij
              </button>
            ) : null}
            {detail ? (
              <button
                type="button"
                onClick={handleToggleEditing}
                disabled={saving}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isEditing ? "Anuluj" : "Edytuj"}
              </button>
            ) : null}
          </div>
        }
        fullWidth
      >
        {loadError ? (
          <ScreenState
            title="Nie udalo sie wczytac reklamacji"
            description={loadError}
          />
        ) : !detail ? (
          <ScreenState
            title="Ladowanie szczegolow"
            description="Pobieram reklamacje i historie logow."
          />
        ) : (
          <div
            className={
              hasAsideContent
                ? "grid gap-8 xl:grid-cols-[minmax(0,1.15fr),420px]"
                : "grid gap-8"
            }
          >
            <section className="space-y-8">
              <DetailCard title="Dane reklamacji">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-[220px]">
                    <div className="text-sm text-slate-500">
                      {detail.reklamacja.nazwa_firmy}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <StatusBadge value={detail.reklamacja.status} />
                      {detail.routeStop?.trasy ? (
                        <Link
                          href={`/trasy/${detail.routeStop.trasy.id}`}
                          className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                        >
                          {`Trasa ${getRouteDisplayName(detail.routeStop.trasy)}`}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="min-w-[260px] flex-1 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Numer reklamacji
                    </div>
                    <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                      {complaintDisplayNumber}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <div>
                        Dodano:{" "}
                        {formatDate(
                          detail.reklamacja.data_zgloszenia,
                          showServiceTimes
                        )}
                      </div>
                      <div className="mt-1">
                        Termin:{" "}
                        {formatDate(
                          detail.reklamacja.realizacja_do,
                          showServiceTimes
                        )}
                      </div>
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Potwierdzenie SMS
                        </div>
                        <RouteSmsStatusControl
                          status={smsConfirmationDisplay.status}
                          readOnly
                          tooltipLabel={smsConfirmationDisplay.tooltipLabel}
                        />
                      </div>
                    </div>
                    {profile.role === ROLE.ADMIN ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Element odebrany
                        </div>
                        <div className="mt-2">
                          <PickedUpIndicator checked={isElementPickedUp} />
                        </div>
                        <button
                          type="button"
                          onClick={handleTogglePickedUp}
                          disabled={saving}
                          className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isElementPickedUp
                            ? "Cofnij oznaczenie"
                            : "Oznacz jako odebrany"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Nazwa mebla
                    </div>
                    <div className="mt-2 font-semibold text-slate-950">
                      {detail.reklamacja.nazwa_mebla || "-"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Klient
                    </div>
                    <div className="mt-2 font-semibold text-slate-950">
                      {customerName || "—"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Telefon
                    </div>
                    <div className="mt-2 font-semibold text-slate-950">
                      {detail.reklamacja.telefon_klienta ? (
                        <a
                          href={customerPhoneHref || "#"}
                          className="text-sky-700 hover:text-sky-900"
                        >
                          {detail.reklamacja.telefon_klienta}
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Adres klienta
                    </div>
                    <div className="mt-2 font-semibold text-slate-950">
                      {detail.reklamacja.kod_pocztowy
                        ? `${detail.reklamacja.kod_pocztowy} `
                        : ""}
                      {detail.reklamacja.miejscowosc}
                      {detail.reklamacja.miejscowosc || detail.reklamacja.adres
                        ? ", "
                        : ""}
                      {detail.reklamacja.adres || "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Informacje od Meblofix
                  </div>
                  <div className="mt-3 whitespace-pre-wrap text-slate-800">
                    {detail.reklamacja.informacje?.trim()
                      ? detail.reklamacja.informacje
                      : "Brak informacji od Meblofix."}
                  </div>
                </div>

                <fieldset
                  disabled={!isEditing || saving}
                  className="mt-6 grid gap-4 md:grid-cols-2"
                >
                  <label className="text-sm text-slate-700">
                    Numer reklamacji
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                      value={editState.numer_faktury}
                      placeholder="Numer reklamacji"
                      onChange={(event) =>
                        setEditState((current) => ({
                          ...current,
                          numer_faktury: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    Nazwa mebla
                    <input
                      required
                      maxLength={MAX_FURNITURE_NAME_LENGTH}
                      className={`mt-2 w-full rounded-2xl border px-4 py-3 ${
                        editFurnitureError ? "border-rose-300" : "border-slate-200"
                      }`}
                      value={editState.nazwa_mebla}
                      placeholder="Nazwa mebla"
                      onChange={(event) => {
                        const nextValue = event.target.value.slice(
                          0,
                          MAX_FURNITURE_NAME_LENGTH
                        );

                        if (nextValue.trim()) {
                          setEditFurnitureError("");
                        }

                        setEditState((current) => ({
                          ...current,
                          nazwa_mebla: nextValue,
                        }));
                      }}
                    />
                    {editFurnitureError ? (
                      <div className="mt-2 text-xs text-rose-600">
                        {editFurnitureError}
                      </div>
                    ) : null}
                  </label>
                  <label className="text-sm text-slate-700">
                    Imie klienta
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                      value={editState.imie_klienta}
                      placeholder="Imie klienta"
                      onChange={(event) =>
                        setEditState((current) => ({
                          ...current,
                          imie_klienta: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    Nazwisko klienta
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                      value={editState.nazwisko_klienta}
                      placeholder="Nazwisko klienta"
                      onChange={(event) =>
                        setEditState((current) => ({
                          ...current,
                          nazwisko_klienta: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    Numer telefonu klienta
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                      value={editState.telefon_klienta}
                      placeholder="+48 123 456 789"
                      onChange={(event) =>
                        setEditState((current) => ({
                          ...current,
                          telefon_klienta: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    Termin realizacji
                    <input
                      type={showServiceTimes ? "datetime-local" : "date"}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                      value={
                        showServiceTimes
                          ? editState.realizacja_do
                          : toDateInputValue(editState.realizacja_do)
                      }
                      onChange={(event) => {
                        setEditDeadlineError("");
                        setEditState((current) => ({
                          ...current,
                          realizacja_do: event.target.value,
                        }));
                      }}
                    />
                    {editDeadlineError ? (
                      <div className="mt-2 text-xs text-rose-600">
                        {editDeadlineError}
                      </div>
                    ) : null}
                  </label>
                  <label className="text-sm text-slate-700">
                    Kod pocztowy
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                      value={editState.kod_pocztowy}
                      placeholder="Kod pocztowy (XX-XXX)"
                      disabled={userAddressEditBlocked}
                      onChange={(event) => {
                        setAddressPreview(null);
                        setEditState((current) => ({
                          ...current,
                          kod_pocztowy: event.target.value,
                        }));
                      }}
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    Miejscowosc
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                      value={editState.miejscowosc}
                      placeholder="Miasto"
                      disabled={userAddressEditBlocked}
                      onChange={(event) => {
                        setAddressPreview(null);
                        setEditState((current) => ({
                          ...current,
                          miejscowosc: event.target.value,
                        }));
                      }}
                    />
                  </label>
                  <label className="text-sm text-slate-700 md:col-span-2">
                    Adres
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                      value={editState.adres}
                      placeholder="Nazwa ulicy + numer"
                      disabled={userAddressEditBlocked}
                      onChange={(event) => {
                        setAddressPreview(null);
                        setEditState((current) => ({
                          ...current,
                          adres: event.target.value,
                        }));
                      }}
                    />
                    {userAddressEditBlocked ? (
                      <div className="mt-2 text-xs text-slate-500">
                        Adres moze zmienic tylko admin, gdy punkt jest w trasie
                        lub zaplanowany i potwierdzony.
                      </div>
                    ) : null}
                  </label>
                  <label className="text-sm text-slate-700 md:col-span-2">
                    Opis
                    <textarea
                      className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3"
                      value={editState.opis}
                      placeholder="Opis reklamacji"
                      onChange={(event) =>
                        setEditState((current) => ({
                          ...current,
                          opis: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-700 md:col-span-2">
                    Informacje od zglaszajacego
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3"
                      value={editState.informacje_od_zglaszajacego}
                      placeholder="Informacje od zglaszajacego"
                      onChange={(event) => {
                        setEditReporterInfoError("");
                        setEditState((current) => ({
                          ...current,
                          informacje_od_zglaszajacego: event.target.value,
                        }));
                      }}
                    />
                    {editReporterInfoError ? (
                      <div className="mt-2 text-xs text-rose-600">
                        {editReporterInfoError}
                      </div>
                    ) : null}
                  </label>
                  {profile.role === ROLE.ADMIN ? (
                    <label className="text-sm text-slate-700 md:col-span-2">
                      Informacje od Meblofix
                      <textarea
                        className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3"
                        value={editState.informacje}
                        onChange={(event) =>
                          setEditState((current) => ({
                            ...current,
                            informacje: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ) : null}
                </fieldset>

                {isEditing ? (
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                      onClick={handleSave}
                      disabled={saving || previewingAddress}
                    >
                      {previewingAddress
                        ? "Sprawdzam adres..."
                        : saving
                          ? "Zapisywanie..."
                          : "Zapisz zmiany"}
                    </button>
                  </div>
                ) : null}

                {profile.role === ROLE.ADMIN && isEditing && manualStatusChangeBlocked ? (
                  <div className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-slate-700">
                    Reczna zmiana statusu jest zablokowana, bo reklamacja jest przypisana
                    do aktywnej trasy
                    {blockingRoute ? (
                      <>
                        {" "}
                        <span className="font-semibold text-slate-950">
                          {getRouteDisplayName(blockingRoute)}
                        </span>
                      </>
                    ) : null}
                    .
                  </div>
                ) : null}
              </DetailCard>

              <DetailCard title="Zalaczniki zgloszenia">
                <div className="space-y-6">
                  {detail.reklamacja.zalacznik_pdf ? (
                    <div>
                      <div className="text-sm font-semibold text-slate-800">PDF zgloszenia</div>
                      <div className="mt-3">
                        <a
                          href={getPublicStorageUrl(detail.reklamacja.zalacznik_pdf)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          Otworz PDF
                        </a>
                      </div>
                    </div>
                  ) : null}
                  {images.length ? (
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        Zdjecia zgloszenia
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {images.map((image) => (
                          <StoredImageTile
                            key={image}
                            path={image}
                            fallbackName="Zdjecie"
                            imageClassName="h-44"
                            onClick={setPreviewImage}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {!detail.reklamacja.zalacznik_pdf && !images.length ? (
                    <div className="text-slate-400">
                      Brak zalacznikow do zgloszenia.
                    </div>
                  ) : null}
                </div>
              </DetailCard>

              <DetailCard
                title="Zakonczenie reklamacji"
                actions={
                  profile.role === ROLE.ADMIN ? (
                    <>
                      {complaintClosed ? (
                        <button
                          type="button"
                          className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => setCloseModalMode("edit-date")}
                          disabled={saving}
                        >
                          Zmien date zakonczenia
                        </button>
                      ) : null}
                      {isEditing ? (
                        <button
                          type="button"
                          className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() =>
                            setCloseModalMode(
                              complaintClosed || completionVisible ? "edit" : "close"
                            )
                          }
                          disabled={saving || manualStatusChangeBlocked}
                        >
                          {complaintClosed || completionVisible
                            ? "Edytuj zakonczenie"
                            : "Zakoncz reklamacje"}
                        </button>
                      ) : null}
                    </>
                  ) : null
                }
              >
                {completionVisible ? (
                  <div className="space-y-6">
                    <div className="rounded-[1.5rem] bg-slate-50 px-5 py-4 text-sm text-slate-700">
                      <div>
                        Data zakonczenia:{" "}
                        <span className="font-semibold text-slate-900">
                          {formatDate(
                            detail.reklamacja.data_zakonczenia,
                            showServiceTimes
                          )}
                        </span>
                      </div>
                    </div>

                    {detail.reklamacja.opis_przebiegu ? (
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          Opis przebiegu
                        </div>
                        <div className="mt-2 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm whitespace-pre-wrap text-slate-700">
                          {detail.reklamacja.opis_przebiegu}
                        </div>
                      </div>
                    ) : null}

                    {detail.reklamacja.zalacznik_pdf_zakonczenie ? (
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          PDF zakonczenia
                        </div>
                        <div className="mt-2">
                          <a
                            href={getPublicStorageUrl(
                              detail.reklamacja.zalacznik_pdf_zakonczenie
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                          >
                            {storagePathToFileName(
                              detail.reklamacja.zalacznik_pdf_zakonczenie,
                              "zakonczenie.pdf"
                            )}
                          </a>
                        </div>
                      </div>
                    ) : null}

                    {completionImages.length ? (
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          Zdjecia zakonczenia
                        </div>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          {completionImages.map((path) => (
                            <StoredImageTile
                              key={path}
                              path={path}
                              fallbackName="Zdjecie zakonczenia"
                              imageClassName="h-44"
                              onClick={setPreviewImage}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-slate-500">
                    {profile.role === ROLE.ADMIN
                      ? "Po zakonczeniu reklamacji opis przebiegu i zalaczniki pojawia sie tutaj."
                      : "Ta reklamacja nie ma jeszcze zapisanych danych zakonczenia."}
                  </p>
                )}

                {profile.role === ROLE.ADMIN && isEditing && manualStatusChangeBlocked ? (
                  <p className="mt-4 text-sm text-amber-700">
                    Zamkniecie reklamacji jest chwilowo zablokowane, dopoki punkt pozostaje
                    na aktywnej trasie.
                  </p>
                ) : null}
              </DetailCard>

              <DetailCard title="Historia dzialan">
                {detail.logs.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Data</th>
                          <th className="px-3 py-2">Akcja</th>
                          <th className="px-3 py-2">Kto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.logs.map((log) => {
                          const actor = formatLogActor(log, profile?.role);
                          const rowStyle =
                            OPERATIONAL_LOG_ROW_STYLES[
                              getOperationalLogTone(log)
                            ] || OPERATIONAL_LOG_ROW_STYLES.neutral;

                          return (
                            <tr key={log.id} className={cn(rowStyle)}>
                              <td className="px-3 py-3">
                                {formatDate(log.created_at, showServiceTimes)}
                              </td>
                              <td className="px-3 py-3">
                                {formatOperationalLogAction(log, {
                                  withTime: showServiceTimes,
                                })}
                              </td>
                              <td className="px-3 py-3">
                                {actor.name}
                                {actor.role ? (
                                  <span className="ml-2 text-xs text-slate-500">
                                    ({actor.role})
                                  </span>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500">Brak logow dla tej reklamacji.</p>
                )}
              </DetailCard>
            </section>

            {hasAsideContent ? (
              <aside className="space-y-8">
                {showAdminSections ? (
                  <>
                    <DetailCard title="Powiazana trasa">
                      {detail.routeStop?.trasy ? (
                        <div className="space-y-3 text-sm text-slate-700">
                          <div>
                            Nazwa: {detail.routeStop.trasy.nazwa || "Brak nazwy wlasnej"}
                          </div>
                          <div>
                            Numer:{" "}
                            <Link
                              href={`/trasy/${detail.routeStop.trasy.id}`}
                              className="font-semibold text-indigo-700 hover:text-indigo-900"
                            >
                              {detail.routeStop.trasy.numer}
                            </Link>
                          </div>
                          <div>
                            Status trasy: <StatusBadge value={detail.routeStop.trasy.status} />
                          </div>
                          <div>Kolejnosc punktu: {detail.routeStop.kolejnosc}</div>
                          <div>ETA od: {formatEtaDate(detail.routeStop.eta_from)}</div>
                          <div>ETA do: {formatEtaDate(detail.routeStop.eta_to)}</div>
                          <div>
                            Dystans od poprzedniego:{" "}
                            {formatDistance(detail.routeStop.distance_from_prev_m)}
                          </div>
                          <div>
                            Czas od poprzedniego:{" "}
                            {formatDuration(detail.routeStop.duration_from_prev_s)}
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-500">
                          Ta reklamacja nie jest obecnie przypisana do aktywnej trasy.
                        </p>
                      )}
                    </DetailCard>
                  </>
                ) : null}

              </aside>
            ) : null}
          </div>
        )}
      </AppShell>

      <ComplaintAddressPreviewModal
        preview={addressPreview}
        profile={profile}
        submitting={saving}
        onClose={() => {
          if (!saving) {
            setAddressPreview(null);
          }
        }}
        onConfirm={handleConfirmAddress}
      />

      <ComplaintCloseModal
        isOpen={Boolean(closeModalMode && detail?.reklamacja)}
        mode={
          closeModalMode === "edit" || closeModalMode === "edit-date"
            ? "edit"
            : "close"
        }
        initialValue={{
          data_zakonczenia: detail?.reklamacja?.data_zakonczenia || null,
          informacje: detail?.reklamacja?.informacje || "",
          opis_przebiegu: detail?.reklamacja?.opis_przebiegu || "",
          zalacznik_pdf_zakonczenie:
            detail?.reklamacja?.zalacznik_pdf_zakonczenie || null,
          zalacznik_zakonczenie:
            safeArray(detail?.reklamacja?.zalacznik_zakonczenie),
        }}
        onClose={() => {
          if (!saving) {
            setCloseModalMode(null);
          }
        }}
        onSubmit={handleCloseSubmit}
        showCompletionDate={profile?.role === ROLE.ADMIN && closeModalMode !== null}
      />

      <ComplaintAcceptModal
        isOpen={acceptModalOpen}
        reklamacja={detail?.reklamacja || null}
        loading={saving}
        onClose={() => {
          if (!saving) {
            setAcceptModalOpen(false);
          }
        }}
        onSubmit={handleAcceptSubmit}
      />

      <ComplaintChangesAcknowledgeModal
        isOpen={showChangesAcknowledgeModal}
        changes={filteredPendingUserChanges}
        loading={saving}
        onClose={handleDismissChangesModal}
        onConfirm={handleAcknowledge}
      />

      <ComplaintSmsRejectionModal
        isOpen={showSmsRejectionAlert}
        message={pendingSmsRejectionAlert.message}
        loading={acknowledgingSmsRejection}
        onClose={handleAcknowledgeSmsRejectionAlert}
      />

      <ImagePreviewModal
        image={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </>
  );
}

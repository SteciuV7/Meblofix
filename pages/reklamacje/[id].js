import { AppShell } from "@/components/layout/AppShell";
import PickedUpIndicator from "@/components/PickedUpIndicator";
import { ScreenState } from "@/components/layout/ScreenState";
import { StatusBadge } from "@/components/StatusBadge";
import ComplaintAcceptModal from "@/components/reklamacje/ComplaintAcceptModal";
import ComplaintChangesAcknowledgeModal from "@/components/reklamacje/ComplaintChangesAcknowledgeModal";
import ComplaintCloseModal from "@/components/reklamacje/ComplaintCloseModal";
import ImagePreviewModal from "@/components/reklamacje/ImagePreviewModal";
import StoredImageTile from "@/components/reklamacje/StoredImageTile";
import RouteSmsStatusControl from "@/components/trasy/RouteSmsStatusControl";
import { storagePathToFileName } from "@/components/reklamacje/AttachmentDropzone";
import {
  ACCEPTABLE_REKLAMACJA_STATUSES,
  REKLAMACJA_STATUS,
  ROLE,
} from "@/lib/constants";
import { apiFetch } from "@/lib/client-api";
import { getPublicStorageUrl } from "@/lib/storage";
import { useCurrentProfile } from "@/lib/use-current-profile";
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatEtaDate,
  getComplaintCustomerName,
  getPhoneHref,
  getRouteDisplayName,
  labelForOperationalAction,
  safeArray,
} from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

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

export default function ReklamacjaDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { profile, loading, error } = useCurrentProfile();
  const [detail, setDetail] = useState(null);
  const [editState, setEditState] = useState(buildEditState(null));
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [changesModalDismissedForId, setChangesModalDismissedForId] =
    useState(null);
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
  const routeStopSmsStatus =
    detail?.routeStop?.smsConfirmationStatus ||
    detail?.routeStop?.sms_potwierdzenie_status;
  const pendingUserChanges = detail?.pendingUserChanges || {
    hasChanges: false,
    events: [],
  };
  const showAdminSections = profile?.role === ROLE.ADMIN;
  const showChangesAcknowledgeModal =
    profile?.role !== ROLE.ADMIN &&
    detail?.reklamacja?.nieprzeczytane_dla_uzytkownika &&
    pendingUserChanges.hasChanges &&
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

  async function handleSave() {
    const success = await update("update", {
      ...editState,
      realizacja_do: editState.realizacja_do
        ? new Date(editState.realizacja_do).toISOString()
        : null,
    });

    if (success) {
      setIsEditing(false);
    }
  }

  async function handleCloseSubmit(payload) {
    setSaving(true);

    try {
      await apiFetch(`/api/reklamacje/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: closeModalMode === "edit" ? "update-close-data" : "close",
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
      setIsEditing(false);
      return;
    }

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
                      <div>Dodano: {formatDate(detail.reklamacja.data_zgloszenia, true)}</div>
                      <div className="mt-1">
                        Termin: {formatDate(detail.reklamacja.realizacja_do, true)}
                      </div>
                      {detail.routeStop ? (
                        <div className="mt-3 border-t border-slate-200 pt-3">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Potwierdzenie SMS
                          </div>
                          <RouteSmsStatusControl
                            status={routeStopSmsStatus}
                            readOnly
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Element odebrany
                      </div>
                      <div className="mt-2">
                        <PickedUpIndicator checked={isElementPickedUp} />
                      </div>
                      {profile.role === ROLE.ADMIN ? (
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
                      ) : null}
                    </div>
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
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                      value={editState.nazwa_mebla}
                      placeholder="Nazwa mebla"
                      onChange={(event) =>
                        setEditState((current) => ({
                          ...current,
                          nazwa_mebla: event.target.value,
                        }))
                      }
                    />
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
                      type="datetime-local"
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                      value={editState.realizacja_do}
                      onChange={(event) =>
                        setEditState((current) => ({
                          ...current,
                          realizacja_do: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    Kod pocztowy
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                      value={editState.kod_pocztowy}
                      placeholder="Kod pocztowy (XX-XXX)"
                      onChange={(event) =>
                        setEditState((current) => ({
                          ...current,
                          kod_pocztowy: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    Miejscowosc
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                      value={editState.miejscowosc}
                      placeholder="Miasto"
                      onChange={(event) =>
                        setEditState((current) => ({
                          ...current,
                          miejscowosc: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-700 md:col-span-2">
                    Adres
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                      value={editState.adres}
                      placeholder="Nazwa ulicy + numer"
                      onChange={(event) =>
                        setEditState((current) => ({
                          ...current,
                          adres: event.target.value,
                        }))
                      }
                    />
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
                      onChange={(event) =>
                        setEditState((current) => ({
                          ...current,
                          informacje_od_zglaszajacego: event.target.value,
                        }))
                      }
                    />
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
                      disabled={saving}
                    >
                      {saving ? "Zapisywanie..." : "Zapisz zmiany"}
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
                  profile.role === ROLE.ADMIN && isEditing ? (
                    <button
                      type="button"
                      className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() =>
                        setCloseModalMode(complaintClosed || completionVisible ? "edit" : "close")
                      }
                      disabled={saving || manualStatusChangeBlocked}
                    >
                      {complaintClosed || completionVisible
                        ? "Edytuj zakonczenie"
                        : "Zakoncz reklamacje"}
                    </button>
                  ) : null
                }
              >
                {completionVisible ? (
                  <div className="space-y-6">
                    <div className="rounded-[1.5rem] bg-slate-50 px-5 py-4 text-sm text-slate-700">
                      <div>
                        Data zakonczenia:{" "}
                        <span className="font-semibold text-slate-900">
                          {formatDate(detail.reklamacja.data_zakonczenia, true)}
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

              {showAdminSections ? (
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
                          {detail.logs.map((log) => (
                            <tr key={log.id} className="border-t border-slate-200">
                              <td className="px-3 py-3">
                                {formatDate(log.created_at, true)}
                              </td>
                              <td className="px-3 py-3">
                                {labelForOperationalAction(log.action)}
                              </td>
                              <td className="px-3 py-3">
                                {log.actor_email || "system"}
                                {log.actor_role ? (
                                  <span className="ml-2 text-xs text-slate-500">
                                    ({log.actor_role})
                                  </span>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500">Brak logow dla tej reklamacji.</p>
                  )}
                </DetailCard>
              ) : null}
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

      <ComplaintCloseModal
        isOpen={Boolean(closeModalMode && detail?.reklamacja)}
        mode={closeModalMode === "edit" ? "edit" : "close"}
        initialValue={{
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
        changes={pendingUserChanges}
        loading={saving}
        onClose={handleDismissChangesModal}
        onConfirm={handleAcknowledge}
      />

      <ImagePreviewModal
        image={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </>
  );
}

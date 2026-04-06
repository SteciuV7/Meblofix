import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { PhoneCall } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ScreenState } from "@/components/layout/ScreenState";
import { StatusBadge } from "@/components/StatusBadge";
import ComplaintCloseModal from "@/components/reklamacje/ComplaintCloseModal";
import RouteStopsList from "@/components/trasy/RouteStopsList";
import RouteUndeliverModal from "@/components/trasy/RouteUndeliverModal";
import {
  ROLE,
  ROUTE_STATUS,
  ROUTE_STOP_FINAL_STATUSES,
} from "@/lib/constants";
import { apiFetch } from "@/lib/client-api";
import { useCurrentProfile } from "@/lib/use-current-profile";
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatEtaDate,
  getComplaintCustomerName,
  getPhoneHref,
  getRouteDisplayName,
  safeArray,
} from "@/lib/utils";

const RouteMap = dynamic(() => import("@/components/maps/RouteMap"), {
  ssr: false,
});

function buildDirectionsHref(stop) {
  const complaint = stop?.reklamacje || {};
  const lat = complaint.lat ?? stop?.lat;
  const lon = complaint.lon ?? stop?.lon;

  if (lat != null && lon != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      `${lat},${lon}`
    )}&travelmode=driving`;
  }

  const destination = [
    complaint.adres,
    complaint.kod_pocztowy,
    complaint.miejscowosc,
  ]
    .filter(Boolean)
    .join(", ");

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination
  )}&travelmode=driving`;
}

export default function DriverRoutePage() {
  const router = useRouter();
  const { id } = router.query;
  const { profile, loading, error } = useCurrentProfile();
  const [detail, setDetail] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [undeliverTargetStopId, setUndeliverTargetStopId] = useState(null);
  const [deliverTargetStopId, setDeliverTargetStopId] = useState(null);

  useEffect(() => {
    if (error) {
      router.push("/login");
    }
  }, [error, router]);

  useEffect(() => {
    if (!profile) return;
    if (profile.role !== ROLE.ADMIN) {
      router.replace("/dashboard");
      return;
    }

    if (!id) return;
    let active = true;

    async function load() {
      try {
        const response = await apiFetch(`/api/trasy/${id}`);
        if (!active) return;
        setLoadError(null);
        setActionError(null);
        setDetail(response);
      } catch (err) {
        if (!active) return;
        setLoadError(err.message || "Nie udalo sie pobrac trasy.");
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [id, profile, router]);

  const orderedStops = useMemo(() => detail?.stops || [], [detail?.stops]);
  const nextStop = useMemo(
    () =>
      orderedStops.find(
        (stop) => !ROUTE_STOP_FINAL_STATUSES.includes(stop.status)
      ) || null,
    [orderedStops]
  );

  const deliverTargetStop = useMemo(
    () => orderedStops.find((stop) => stop.id === deliverTargetStopId) || null,
    [deliverTargetStopId, orderedStops]
  );
  const undeliverTargetStop = useMemo(
    () => orderedStops.find((stop) => stop.id === undeliverTargetStopId) || null,
    [undeliverTargetStopId, orderedStops]
  );

  const routeBaseAddress =
    detail?.mapBase?.adres_bazy ||
    detail?.route?.base_address_snapshot ||
    "Brak adresu magazynu";
  const canStart =
    detail?.route?.status === ROUTE_STATUS.PLANNED && orderedStops.length > 0;
  const canComplete =
    detail?.route?.status === ROUTE_STATUS.IN_PROGRESS &&
    orderedStops.length > 0 &&
    orderedStops.every((stop) => ROUTE_STOP_FINAL_STATUSES.includes(stop.status));

  async function refresh() {
    const response = await apiFetch(`/api/trasy/${id}`);
    setLoadError(null);
    setActionError(null);
    setDetail(response);
  }

  async function handleStart() {
    try {
      setSaving(true);
      setActionError(null);
      await apiFetch(`/api/trasy/${id}/start`, { method: "POST" });
      await refresh();
    } catch (err) {
      setActionError(err.message || "Nie udalo sie wystartowac trasy.");
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    try {
      setSaving(true);
      setActionError(null);
      await apiFetch(`/api/trasy/${id}/complete`, { method: "POST" });
      await refresh();
    } catch (err) {
      setActionError(err.message || "Nie udalo sie ukonczyc trasy.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeliverSubmit(payload) {
    if (!deliverTargetStop) {
      return;
    }

    setSaving(true);

    try {
      await apiFetch(`/api/trasy/${id}/stops/${deliverTargetStop.id}/deliver`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setDeliverTargetStopId(null);
      await refresh();
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleUndeliverConfirm() {
    if (!undeliverTargetStop) {
      return;
    }

    try {
      setSaving(true);
      setActionError(null);
      await apiFetch(`/api/trasy/${id}/stops/${undeliverTargetStop.id}/undeliver`, {
        method: "POST",
      });
      setUndeliverTargetStopId(null);
      await refresh();
    } catch (err) {
      setActionError(
        err.message || "Nie udalo sie oznaczyc punktu jako niedostarczony."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        Ladowanie...
      </div>
    );
  }

  if (!profile || profile.role !== ROLE.ADMIN) {
    return null;
  }

  const nextComplaint = nextStop?.reklamacje || null;
  const nextCustomerName = getComplaintCustomerName(nextComplaint);
  const nextCustomerPhoneHref = getPhoneHref(nextComplaint?.telefon_klienta);

  return (
    <>
      <AppShell
        profile={profile}
        title={getRouteDisplayName(detail?.route)}
        subtitle="Operacyjny widok trasy do obslugi punktow w telefonie."
        actions={
          <Link
            href="/trasy/panel"
            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Wroc do panelu
          </Link>
        }
        fullWidth
      >
        {loadError ? (
          <ScreenState title="Nie udalo sie wczytac trasy" description={loadError} />
        ) : !detail ? (
          <ScreenState
            title="Ladowanie trasy"
            description="Pobieram dane operacyjne trasy."
          />
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {actionError ? (
              <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
                {actionError}
              </div>
            ) : null}

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-950">Dane trasy</h2>
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Status
                    </div>
                    <div className="mt-3">
                      <StatusBadge value={detail.route.status} />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Data
                    </div>
                    <div className="mt-3 text-xl font-bold text-slate-950">
                      {formatDate(detail.route.data_trasy)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Dystans
                    </div>
                    <div className="mt-3 text-xl font-bold text-slate-950">
                      {formatDistance(detail.route.total_distance_m)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Czas przejazdu
                    </div>
                    <div className="mt-3 text-xl font-bold text-slate-950">
                      {formatDuration(detail.route.total_duration_s)}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-950">Nastepny punkt</h2>
              <div className="rounded-[2rem] border border-slate-300 bg-slate-50 p-6 shadow-sm">
                {nextStop && nextComplaint ? (
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                          {`Punkt ${nextStop.kolejnosc}`}
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-950">
                          {nextComplaint.nazwa_firmy}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          {nextComplaint.kod_pocztowy
                            ? `${nextComplaint.kod_pocztowy} `
                            : ""}
                          {nextComplaint.miejscowosc}
                          {nextComplaint.miejscowosc || nextComplaint.adres ? ", " : ""}
                          {nextComplaint.adres}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge value={nextStop.status} />
                        <StatusBadge value={nextComplaint.status} />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Nr reklamacji
                        </div>
                        <div className="mt-2 font-semibold text-slate-950">
                          {nextComplaint.nr_reklamacji || "-"}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Nr faktury
                        </div>
                        <div className="mt-2 font-semibold text-slate-950">
                          {nextComplaint.numer_faktury || "-"}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Klient
                        </div>
                        <div className="mt-2 font-semibold text-slate-950">
                          {nextCustomerName || "-"}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Telefon
                        </div>
                        <div className="mt-2 flex items-center gap-2 font-semibold text-slate-950">
                          {nextComplaint.telefon_klienta ? (
                            <>
                              <a
                                href={nextCustomerPhoneHref || "#"}
                                className="text-sky-700 hover:text-sky-900"
                              >
                                {nextComplaint.telefon_klienta}
                              </a>
                              <a
                                href={nextCustomerPhoneHref || "#"}
                                aria-label={`Zadzwon do ${nextCustomerName || "klienta"}`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-200 hover:text-emerald-800"
                              >
                                <PhoneCall className="h-4 w-4" />
                              </a>
                            </>
                          ) : (
                            "-"
                          )}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700 sm:col-span-2 xl:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          ETA
                        </div>
                        <div className="mt-2 font-semibold text-emerald-700">
                          {nextStop.eta_from
                            ? formatEtaDate(nextStop.eta_from)
                            : "Brak ETA"}
                        </div>
                        {nextStop.eta_to ? (
                          <div className="mt-1 text-xs text-emerald-700">
                            Okno do {formatEtaDate(nextStop.eta_to)}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {nextComplaint.opis ? (
                      <div className="rounded-[1.5rem] border border-slate-300 bg-slate-100 px-4 py-4 text-sm text-slate-700">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Opis reklamacji
                        </div>
                        <div className="mt-2 whitespace-pre-wrap">{nextComplaint.opis}</div>
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <a
                        href={buildDirectionsHref(nextStop)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-full border border-slate-950/80 bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
                      >
                        🧭 Prowadz do
                      </a>

                      {canStart ? (
                        <button
                          type="button"
                          className="rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={handleStart}
                          disabled={saving}
                        >
                          {saving ? "Uruchamianie..." : "Start trasy"}
                        </button>
                      ) : null}

                      {detail.route.status === ROUTE_STATUS.IN_PROGRESS ? (
                        <>
                          <button
                            type="button"
                            className="rounded-full border border-slate-950/80 bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => setDeliverTargetStopId(nextStop.id)}
                            disabled={saving}
                          >
                            📦 Dostarczony
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-slate-950/80 bg-rose-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => setUndeliverTargetStopId(nextStop.id)}
                            disabled={saving}
                          >
                            ⚠️ Niedostarczony
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : canComplete ? (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xl font-semibold text-slate-950">
                        Wszystkie punkty sa obsluzone
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        Mozesz zakonczyc trase i zamknac przejazd.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={handleComplete}
                      disabled={saving}
                    >
                      {saving ? "Zamykanie..." : "Zakoncz trase"}
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-slate-600">
                    Ta trasa nie ma obecnie kolejnego punktu do obslugi.
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-950">Mapa</h2>
              <RouteMap
                base={detail.mapBase}
                stops={orderedStops.map((stop) => ({
                  id: stop.id,
                  lat: stop.reklamacje.lat,
                  lon: stop.reklamacje.lon,
                  nazwa_firmy: stop.reklamacje.nazwa_firmy,
                  imie_klienta: stop.reklamacje.imie_klienta,
                  nazwisko_klienta: stop.reklamacje.nazwisko_klienta,
                  telefon_klienta: stop.reklamacje.telefon_klienta,
                  adres: stop.reklamacje.adres,
                  miejscowosc: stop.reklamacje.miejscowosc,
                  kod_pocztowy: stop.reklamacje.kod_pocztowy,
                  order: stop.kolejnosc,
                  status: stop.status,
                  eta_from: stop.eta_from,
                  eta_to: stop.eta_to,
                }))}
                encodedPolyline={detail.encodedPolyline}
                height="clamp(300px, 42vh, 560px)"
              />
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-950">
                Pelna lista punktow
              </h2>
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <RouteStopsList
                  stops={orderedStops}
                  routeBaseAddress={routeBaseAddress}
                  plannedStartAt={detail.route.planowany_start_at}
                  returnLegDurationSeconds={detail.returnLegDurationSeconds}
                  returnEtaAt={detail.returnEtaAt}
                  highlightedStopId={nextStop?.id || null}
                />
              </div>
            </section>
          </div>
        )}
      </AppShell>

      <ComplaintCloseModal
        isOpen={Boolean(deliverTargetStop)}
        mode="deliver"
        initialValue={{
          opis_przebiegu: deliverTargetStop?.reklamacje?.opis_przebiegu || "",
          zalacznik_pdf_zakonczenie:
            deliverTargetStop?.reklamacje?.zalacznik_pdf_zakonczenie || null,
          zalacznik_zakonczenie: safeArray(
            deliverTargetStop?.reklamacje?.zalacznik_zakonczenie
          ),
        }}
        onClose={() => {
          if (!saving) {
            setDeliverTargetStopId(null);
          }
        }}
        onSubmit={handleDeliverSubmit}
      />

      <RouteUndeliverModal
        isOpen={Boolean(undeliverTargetStop)}
        stop={undeliverTargetStop}
        loading={saving}
        onClose={() => {
          if (!saving) {
            setUndeliverTargetStopId(null);
          }
        }}
        onConfirm={handleUndeliverConfirm}
      />
    </>
  );
}

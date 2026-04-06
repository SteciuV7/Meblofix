import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import {
  RouteBaseCard,
  RouteEtaBadge,
  RouteLegConnector,
} from "@/components/trasy/RouteTiming";
import { ROLE } from "@/lib/constants";
import { apiFetch } from "@/lib/client-api";
import { useCurrentProfile } from "@/lib/use-current-profile";
import {
  formatDate,
  formatDistance,
  formatDuration,
  getComplaintCustomerName,
  getPhoneHref,
  normalizeText,
} from "@/lib/utils";
import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const RouteMap = dynamic(() => import("@/components/maps/RouteMap"), {
  ssr: false,
});

const DEADLINE_THEMES = {
  blue: {
    card: "border-sky-200 bg-sky-50",
    accent: "bg-sky-400",
    badge: "border border-sky-200 bg-sky-100 text-sky-800",
    marker: "blue",
  },
  yellow: {
    card: "border-amber-200 bg-amber-50",
    accent: "bg-amber-400",
    badge: "border border-amber-200 bg-amber-100 text-amber-800",
    marker: "yellow",
  },
  red: {
    card: "border-rose-200 bg-rose-50",
    accent: "bg-rose-500",
    badge: "border border-rose-200 bg-rose-100 text-rose-800",
    marker: "red",
  },
};

function formatDateTimeLocal(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function nextMorningIsoLocal() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(8, 0, 0, 0);
  return formatDateTimeLocal(date);
}

function getDeadlineMeta(realizacjaDo) {
  if (!realizacjaDo) {
    return {
      tone: "blue",
      daysUntil: null,
      label: "Brak terminu dostawy",
    };
  }

  const diffMs = new Date(realizacjaDo).getTime() - Date.now();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysUntil <= 2) {
    return {
      tone: "red",
      daysUntil,
      label:
        daysUntil <= 0
          ? "Po terminie lub na dzis"
          : `${daysUntil} dni do terminu`,
    };
  }

  if (daysUntil > 5) {
    return {
      tone: "blue",
      daysUntil,
      label: `${daysUntil} dni do terminu`,
    };
  }

  return {
    tone: "yellow",
    daysUntil,
    label: `${daysUntil} dni do terminu`,
  };
}

function LegendDot({ tone }) {
  const color =
    tone === "red"
      ? "bg-rose-500"
      : tone === "yellow"
        ? "bg-amber-400"
        : "bg-sky-400";

  return <span className={`inline-block h-3 w-3 rounded-full ${color}`} />;
}

export default function NewRoutePage() {
  const router = useRouter();
  const { profile, loading, error } = useCurrentProfile();
  const [candidates, setCandidates] = useState([]);
  const [operationalSettings, setOperationalSettings] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [preview, setPreview] = useState(null);
  const [candidatesError, setCandidatesError] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [manualOrder, setManualOrder] = useState(false);
  const [planowanyStartAt, setPlanowanyStartAt] = useState(nextMorningIsoLocal());

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

    let active = true;

    async function load() {
      try {
        const response = await apiFetch("/api/trasy/candidates");
        if (!active) return;
        setCandidatesError(null);
        setCandidates(response.reklamacje || []);
        setOperationalSettings(response.settings || null);
      } catch (err) {
        if (!active) return;
        setCandidatesError(
          err.message || "Nie udalo sie pobrac kandydatow do trasy."
        );
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [profile, router]);

  useEffect(() => {
    if (!selectedIds.length) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    let active = true;

    async function recalc() {
      try {
        const response = await apiFetch("/api/trasy", {
          method: "POST",
          body: JSON.stringify({
            dryRun: true,
            reklamacjeIds: selectedIds,
            planowanyStartAt: new Date(planowanyStartAt).toISOString(),
            optimize: !manualOrder,
          }),
        });

        if (!active) return;
        setPreviewError(null);
        setPreview(response);
        if (response.settings) {
          setOperationalSettings(response.settings);
        }
      } catch (err) {
        if (!active) return;
        setPreview(null);
        setPreviewError(err.message || "Nie udalo sie policzyc trasy.");
      }
    }

    recalc();
    return () => {
      active = false;
    };
  }, [manualOrder, planowanyStartAt, selectedIds]);

  const selectedStops = useMemo(() => {
    if (!preview?.orderedStops?.length) {
      return selectedIds
        .map((id) => candidates.find((candidate) => candidate.id === id))
        .filter(Boolean);
    }

    return preview.orderedStops;
  }, [candidates, preview?.orderedStops, selectedIds]);

  const selectedStopMap = useMemo(
    () => new Map(selectedStops.map((stop, index) => [stop.id, { ...stop, order: index + 1 }])),
    [selectedStops]
  );

  const decoratedCandidates = useMemo(
    () =>
      candidates.map((candidate) => {
        const deadline = getDeadlineMeta(candidate.realizacja_do);
        const selectedStop = selectedStopMap.get(candidate.id);
        return {
          ...candidate,
          selected: selectedIds.includes(candidate.id),
          tone: deadline.tone,
          deadlineLabel: deadline.label,
          daysUntil: deadline.daysUntil,
          order: selectedStop?.order || null,
          eta_from: selectedStop?.eta_from || null,
          eta_to: selectedStop?.eta_to || null,
        };
      }),
    [candidates, selectedIds, selectedStopMap]
  );

  const filteredCandidates = useMemo(() => {
    const normalizedQuery = normalizeText(search.trim().toLowerCase());

    if (!normalizedQuery) {
      return decoratedCandidates;
    }

    return decoratedCandidates.filter((candidate) => {
      const haystack = normalizeText(
        [
          candidate.nazwa_firmy,
          candidate.imie_klienta,
          candidate.nazwisko_klienta,
          candidate.telefon_klienta,
          candidate.numer_faktury,
          candidate.nr_reklamacji,
          candidate.kod_pocztowy,
          candidate.miejscowosc,
          candidate.adres,
          candidate.opis,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
      );

      return haystack.includes(normalizedQuery);
    });
  }, [decoratedCandidates, search]);

  const mapStops = useMemo(
    () =>
      decoratedCandidates.map((candidate) => ({
        ...candidate,
        tone: DEADLINE_THEMES[candidate.tone]?.marker || "blue",
      })),
    [decoratedCandidates]
  );

  const activeSettings = preview?.settings || operationalSettings;
  const routeBaseAddress = activeSettings?.adres_bazy || "Brak aktywnej bazy";

  async function handleCreateRoute() {
    try {
      setSaving(true);
      const response = await apiFetch("/api/trasy", {
        method: "POST",
        body: JSON.stringify({
          reklamacjeIds: selectedIds,
          planowanyStartAt: new Date(planowanyStartAt).toISOString(),
          routeName: routeName.trim() || null,
          notes,
          optimize: !manualOrder,
        }),
      });
      router.push(`/trasy/${response.routeId}`);
    } catch (err) {
      setPreviewError(err.message || "Nie udalo sie utworzyc trasy.");
    } finally {
      setSaving(false);
    }
  }

  function addCandidate(candidateId) {
    setPreviewError(null);
    setSelectedIds((current) =>
      current.includes(candidateId) ? current : [...current, candidateId]
    );
  }

  function removeCandidate(candidateId) {
    setPreviewError(null);
    setSelectedIds((current) => current.filter((id) => id !== candidateId));
  }

  function toggleCandidate(candidateId) {
    if (selectedIds.includes(candidateId)) {
      removeCandidate(candidateId);
      return;
    }

    addCandidate(candidateId);
  }

  function moveCandidate(candidateId, direction) {
    setPreviewError(null);
    setManualOrder(true);
    setSelectedIds((current) => {
      const index = current.indexOf(candidateId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const updated = [...current];
      [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
      return updated;
    });
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

  return (
    <AppShell
      profile={profile}
      title="Utworz trase"
      subtitle="Kandydaci sa po lewej, mapa po prawej. Mozesz dodawac punkty z listy i bezposrednio z mapy."
      actions={
        <Link
          href="/trasy"
          className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
        >
          Wroc do tras
        </Link>
      }
      fullWidth
    >
      <div className="space-y-6">
        <section className="min-w-0 space-y-6">
          <div className="grid gap-4 xl:grid-cols-3">
            <label className="rounded-[1.75rem] border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              <div className="font-semibold text-slate-900">Planowany start</div>
              <input
                type="datetime-local"
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
                value={planowanyStartAt}
                onChange={(event) => setPlanowanyStartAt(event.target.value)}
              />
            </label>

            <label className="rounded-[1.75rem] border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              <div className="font-semibold text-slate-900">Nazwa trasy</div>
              <input
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500"
                value={routeName}
                onChange={(event) => setRouteName(event.target.value)}
                placeholder="Np. KEPNO - poranna dostawa"
              />
              <div className="mt-2 text-xs text-slate-500">
                Opcjonalnie. Numer trasy nadal zostanie nadany automatycznie.
              </div>
            </label>

            <label className="rounded-[1.75rem] border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              <div className="font-semibold text-slate-900">Notatki do trasy</div>
              <input
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Opcjonalny komentarz dla kierowcy"
              />
            </label>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-slate-900 shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">Kandydaci i mapa</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Lista i mapa dzialaja jednoczesnie. Mozesz dodawac punkty z obu paneli.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Wybrane: {selectedIds.length}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2">
                  <LegendDot tone="blue" />
                  <span>{"> 5 dni do terminu"}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2">
                  <LegendDot tone="yellow" />
                  <span>3-5 dni do terminu</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2">
                  <LegendDot tone="red" />
                  <span>{"<= 2 dni lub po terminie"}</span>
                </div>
              </div>
            </div>

            <div className="grid min-w-0 gap-0 lg:grid-cols-2">
              <div className="border-b border-slate-200 lg:border-b-0 lg:border-r">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">Kandydaci do trasy</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {filteredCandidates.length} z {decoratedCandidates.length} reklamacji
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Szukaj po firmie, kliencie, telefonie, adresie lub numerze faktury..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500"
                    />
                  </div>

                  {candidatesError ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {candidatesError}
                    </div>
                  ) : null}
                </div>

                <div className="h-[60vh] min-h-[420px] space-y-4 overflow-y-auto px-4 py-4 md:h-[720px]">
                  {filteredCandidates.length ? (
                    filteredCandidates.map((candidate) => {
                      const theme =
                        DEADLINE_THEMES[candidate.tone] || DEADLINE_THEMES.blue;
                      const customerName = getComplaintCustomerName(candidate);
                      const customerPhoneHref = getPhoneHref(
                        candidate.telefon_klienta
                      );

                      return (
                        <div
                          key={candidate.id}
                          className={`rounded-[1.5rem] border p-4 shadow-sm ${theme.card}`}
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-3">
                                <span className={`h-3 w-3 rounded-full ${theme.accent}`} />
                                <div className="truncate text-lg font-semibold text-slate-900">
                                  {candidate.nazwa_firmy}
                                </div>
                                {candidate.order ? (
                                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800">
                                    Punkt {candidate.order}
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-3 space-y-1 text-sm text-slate-600">
                                <div>
                                  {candidate.kod_pocztowy} {candidate.miejscowosc},{" "}
                                  {candidate.adres}
                                </div>
                                {customerName ? <div>Klient: {customerName}</div> : null}
                                {candidate.telefon_klienta ? (
                                  <div>
                                    Telefon:{" "}
                                    <a
                                      href={customerPhoneHref || "#"}
                                      className="font-medium text-emerald-700 hover:text-emerald-800"
                                    >
                                      {candidate.telefon_klienta}
                                    </a>
                                  </div>
                                ) : null}
                                <div>
                                  Termin: {formatDate(candidate.realizacja_do, true)}
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <StatusBadge value={candidate.status} />
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${theme.badge}`}
                                >
                                  {candidate.deadlineLabel}
                                </span>
                                <Link
                                  href={`/reklamacje/${candidate.id}`}
                                  className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                                >
                                  Reklamacja
                                </Link>
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-col gap-3 sm:items-end">
                              <RouteEtaBadge
                                etaFrom={candidate.eta_from}
                                etaTo={candidate.eta_to}
                                className="w-full sm:w-[210px]"
                              />
                              <button
                                type="button"
                                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                  candidate.selected
                                    ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                                    : "bg-sky-500 text-white hover:bg-sky-400"
                                }`}
                                onClick={() => toggleCandidate(candidate.id)}
                              >
                                {candidate.selected ? "Usun" : "Dodaj"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                      Brak kandydatow pasujacych do filtra.
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">Mapa kandydatow i trasy</div>
                      <div className="mt-1 text-sm text-slate-500">
                        Kliknij znacznik, aby dodac lub usunac punkt bez wychodzenia z mapy.
                      </div>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                      Punkty do obsluzenia: {selectedIds.length}
                    </div>
                  </div>
                  <div className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                    Baza: {activeSettings?.adres_bazy || "Brak aktywnej konfiguracji"}
                  </div>
                </div>

                <div className="min-w-0 p-4">
                  <RouteMap
                    base={activeSettings}
                    stops={mapStops}
                    encodedPolyline={preview?.encodedPolyline}
                    height="clamp(320px, 60vh, 720px)"
                    renderStopActions={(stop) => (
                      <button
                        type="button"
                        className={`w-full rounded-full px-4 py-2 text-sm font-semibold transition ${
                          stop.selected
                            ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                            : "bg-sky-500 text-white hover:bg-sky-400"
                        }`}
                        onClick={() => toggleCandidate(stop.id)}
                      >
                        {stop.selected ? "Usun z trasy" : "Dodaj do trasy"}
                      </button>
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          {previewError ? (
            <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
              {previewError}
            </div>
          ) : null}

          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr),360px]">
            <div className="min-w-0 rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Wybrane punkty</h2>
                {manualOrder ? (
                  <button
                    type="button"
                    className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    onClick={() => setManualOrder(false)}
                  >
                    Wlacz autooptymalizacje
                  </button>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-semibold text-emerald-700">
                    Autooptymalizacja wlaczona
                  </span>
                )}
              </div>

              {selectedStops.length ? (
                <div className="mt-5 space-y-1">
                  <RouteBaseCard
                    title="Start z magazynu"
                    address={routeBaseAddress}
                    caption={
                      planowanyStartAt
                        ? `Planowany start: ${formatDate(
                            new Date(planowanyStartAt).toISOString(),
                            true
                          )}`
                        : "Punkt poczatkowy trasy"
                    }
                  />
                  {selectedStops[0]?.duration_from_prev_s != null ? (
                    <RouteLegConnector
                      durationSeconds={selectedStops[0].duration_from_prev_s}
                      label="Dojazd z magazynu do punktu 1"
                    />
                  ) : null}

                  {selectedStops.map((stop, index) => {
                    const customerName = getComplaintCustomerName(stop);
                    const customerPhoneHref = getPhoneHref(stop.telefon_klienta);

                    return (
                      <div key={stop.id}>
                        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                Punkt {index + 1}
                              </div>
                              <div className="mt-2 text-lg font-semibold text-slate-900">
                                {stop.nazwa_firmy}
                              </div>
                              <div className="mt-1 text-sm text-slate-600">
                                {stop.miejscowosc}, {stop.adres}
                              </div>
                              {customerName || stop.telefon_klienta ? (
                                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      Imie
                                    </div>
                                    <div className="mt-2 font-semibold text-slate-950">
                                      {stop.imie_klienta || "-"}
                                    </div>
                                  </div>
                                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      Nazwisko
                                    </div>
                                    <div className="mt-2 font-semibold text-slate-950">
                                      {stop.nazwisko_klienta || "-"}
                                    </div>
                                  </div>
                                  <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100 sm:col-span-3 lg:col-span-1">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                      Telefon
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                      <div className="font-semibold text-emerald-950">
                                        {stop.telefon_klienta || "-"}
                                      </div>
                                      {stop.telefon_klienta ? (
                                        <a
                                          href={customerPhoneHref || "#"}
                                          aria-label={`Zadzwon do ${customerName || "klienta"}`}
                                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100 hover:text-emerald-800"
                                        >
                                          <PhoneCall className="h-4 w-4" />
                                        </a>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            <div className="flex flex-col gap-3 sm:items-end">
                              <RouteEtaBadge
                                etaFrom={stop.eta_from}
                                etaTo={stop.eta_to}
                                className="w-full sm:w-[220px]"
                              />
                              <div className="flex flex-wrap gap-2 sm:justify-end">
                                <button
                                  type="button"
                                  className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                                  onClick={() => moveCandidate(stop.id, -1)}
                                >
                                  W gore
                                </button>
                                <button
                                  type="button"
                                  className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                                  onClick={() => moveCandidate(stop.id, 1)}
                                >
                                  W dol
                                </button>
                                <button
                                  type="button"
                                  className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200"
                                  onClick={() => removeCandidate(stop.id)}
                                >
                                  Usun
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        {selectedStops[index + 1] ? (
                          <RouteLegConnector
                            durationSeconds={selectedStops[index + 1].duration_from_prev_s}
                          />
                        ) : null}
                      </div>
                    );
                  })}

                  {preview?.returnLegDurationSeconds != null ? (
                    <RouteLegConnector
                      durationSeconds={preview.returnLegDurationSeconds}
                      label="Dojazd do magazynu"
                    />
                  ) : null}
                  <RouteBaseCard
                    title="Powrot do magazynu"
                    address={routeBaseAddress}
                    caption="Punkt koncowy trasy"
                    etaFrom={preview?.returnEtaAt}
                  />
                </div>
              ) : (
                <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
                  Dodaj pierwszy punkt z listy lub bezposrednio z mapy.
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-6">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
                <h2 className="text-xl font-semibold">Podsumowanie</h2>

                <div className="mt-5 space-y-3 text-sm text-slate-600">
                  <div>Nazwa trasy: {routeName.trim() || "Brak nazwy wlasnej"}</div>
                  <div>Baza: {activeSettings?.adres_bazy || "Brak aktywnej bazy"}</div>
                  <div>Wybrane punkty: {selectedIds.length}</div>
                  <div>
                    Dystans:{" "}
                    {preview
                      ? formatDistance(preview.totalDistanceMeters)
                      : "Dodaj punkty, aby policzyc trase"}
                  </div>
                  <div>
                    Czas przejazdu:{" "}
                    {preview
                      ? formatDuration(preview.totalDurationSeconds)
                      : "Dodaj punkty, aby policzyc trase"}
                  </div>
                  <div>
                    Start:{" "}
                    {planowanyStartAt
                      ? formatDate(new Date(planowanyStartAt).toISOString(), true)
                      : "Brak daty"}
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-6 w-full rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleCreateRoute}
                  disabled={saving || !selectedIds.length}
                >
                  {saving ? "Tworzenie..." : "Utworz trase"}
                </button>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
                <h2 className="text-xl font-semibold">Legenda pilnosci</h2>
                <div className="mt-5 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center gap-3">
                    <LegendDot tone="blue" />
                    <span>Powyzej 5 dni do terminu</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <LegendDot tone="yellow" />
                    <span>Od 3 do 5 dni do terminu</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <LegendDot tone="red" />
                    <span>2 dni lub mniej, albo po terminie</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

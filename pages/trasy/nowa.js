import dynamic from "next/dynamic";
import PickedUpIndicator from "@/components/PickedUpIndicator";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import ComplaintPreviewModal from "@/components/reklamacje/ComplaintPreviewModal";
import {
  RouteBaseCard,
  RouteEtaBadge,
  RouteLegConnector,
  RouteStopDurationField,
} from "@/components/trasy/RouteTiming";
import {
  DEFAULT_OPERATIONAL_SETTINGS,
  REKLAMACJA_STATUS,
  ROLE,
} from "@/lib/constants";
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
import { AlertTriangle, CheckCircle2, MapPin, PhoneCall, X } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const RouteMap = dynamic(() => import("@/components/maps/RouteMap"), {
  ssr: false,
});

const CANDIDATE_STATUS_THEMES = {
  [REKLAMACJA_STATUS.NEW]: {
    card: "border-amber-200 bg-amber-50",
    accent: "bg-amber-400",
    marker: "yellow",
  },
  [REKLAMACJA_STATUS.UPDATED]: {
    card: "border-orange-200 bg-orange-50",
    accent: "bg-orange-400",
    marker: "orange",
  },
  [REKLAMACJA_STATUS.IN_PROGRESS]: {
    card: "border-rose-200 bg-rose-50",
    accent: "bg-rose-500",
    marker: "red",
  },
  [REKLAMACJA_STATUS.WAITING_DELIVERY]: {
    card: "border-fuchsia-200 bg-fuchsia-50",
    accent: "bg-fuchsia-500",
    marker: "fuchsia",
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

function getCandidateTheme(status) {
  return (
    CANDIDATE_STATUS_THEMES[status] || {
      card: "border-slate-200 bg-slate-50",
      accent: "bg-slate-400",
      marker: "neutral",
    }
  );
}

function getDefaultStopPostojMinutes(settings) {
  const parsed = Number(settings?.domyslny_czas_obslugi_min);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_OPERATIONAL_SETTINGS.domyslny_czas_obslugi_min;
}

function normalizeStopPostojMinutes(value, fallbackMinutes) {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 1440) {
    return parsed;
  }

  return fallbackMinutes;
}

function emptyStartPointForm() {
  return {
    kod_pocztowy: "",
    miejscowosc: "",
    adres: "",
  };
}

function formatAddressLabel(requestedAddress = {}) {
  return [
    requestedAddress.addressLine,
    requestedAddress.postalCode,
    requestedAddress.town,
  ]
    .filter(Boolean)
    .join(", ");
}

function buildStartPointPayload(form = {}) {
  return {
    kod_pocztowy: `${form.kod_pocztowy ?? ""}`.trim(),
    miejscowosc: `${form.miejscowosc ?? ""}`.trim(),
    adres: `${form.adres ?? ""}`.trim(),
  };
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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [manualOrder, setManualOrder] = useState(false);
  const [planowanyStartAt, setPlanowanyStartAt] = useState(nextMorningIsoLocal());
  const [previewComplaint, setPreviewComplaint] = useState(null);
  const [useCustomStartPoint, setUseCustomStartPoint] = useState(false);
  const [customStartPointForm, setCustomStartPointForm] = useState(
    emptyStartPointForm()
  );
  const [customStartPointPreview, setCustomStartPointPreview] = useState(null);
  const [previewingStartPoint, setPreviewingStartPoint] = useState(false);
  const [customStartPointError, setCustomStartPointError] = useState("");
  const [czasyPostojuMinByReklamacjaId, setCzasyPostojuMinByReklamacjaId] =
    useState({});

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

  const selectedStopPostojPayload = useMemo(() => {
    const fallbackMinutes = getDefaultStopPostojMinutes(operationalSettings);

    return Object.fromEntries(
      selectedIds.map((reklamacjaId) => [
        reklamacjaId,
        normalizeStopPostojMinutes(
          czasyPostojuMinByReklamacjaId[reklamacjaId],
          fallbackMinutes
        ),
      ])
    );
  }, [czasyPostojuMinByReklamacjaId, operationalSettings, selectedIds]);

  const selectedStartPointOverride = useMemo(() => {
    if (
      !useCustomStartPoint ||
      !customStartPointPreview?.confirmed ||
      !customStartPointPreview?.geocode
    ) {
      return null;
    }

    const formattedAddress =
      customStartPointPreview.geocode.formattedAddress ||
      formatAddressLabel(customStartPointPreview.requestedAddress);

    return {
      address: formattedAddress,
      lat: customStartPointPreview.geocode.lat,
      lon: customStartPointPreview.geocode.lon,
      matchType: customStartPointPreview.geocode.matchType,
    };
  }, [customStartPointPreview, useCustomStartPoint]);

  const isCustomStartPointConfirmOpen = Boolean(
    customStartPointPreview?.geocode && !customStartPointPreview.confirmed
  );

  useEffect(() => {
    if (isCustomStartPointConfirmOpen) {
      setPreviewComplaint(null);
    }
  }, [isCustomStartPointConfirmOpen]);

  useEffect(() => {
    if (!selectedIds.length) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    let active = true;
    const timeoutId = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const response = await apiFetch("/api/trasy", {
          method: "POST",
          body: JSON.stringify({
            dryRun: true,
            reklamacjeIds: selectedIds,
            planowanyStartAt: new Date(planowanyStartAt).toISOString(),
            optimize: !manualOrder,
            czasyPostojuMinByReklamacjaId: selectedStopPostojPayload,
            startPointOverride: selectedStartPointOverride,
          }),
        });

        if (!active) return;
        setPreviewError(null);
        setPreview(response);
      } catch (err) {
        if (!active) return;
        setPreview(null);
        setPreviewError(err.message || "Nie udalo sie policzyc trasy.");
      } finally {
        if (active) {
          setPreviewLoading(false);
        }
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [
    manualOrder,
    planowanyStartAt,
    selectedIds,
    selectedStopPostojPayload,
    selectedStartPointOverride,
  ]);

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
        const selectedStop = selectedStopMap.get(candidate.id);
        const theme = getCandidateTheme(candidate.status);
        return {
          ...candidate,
          selected: selectedIds.includes(candidate.id),
          tone: theme.marker,
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
          candidate.nazwa_mebla,
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
        tone: candidate.tone || "neutral",
      })),
    [decoratedCandidates]
  );

  const activeStartSettings =
    preview?.startBase || preview?.base || preview?.settings || operationalSettings;
  const activeReturnSettings =
    preview?.returnBase || preview?.settings || operationalSettings || activeStartSettings;
  const startBaseAddress =
    selectedStartPointOverride?.address ||
    activeStartSettings?.adres_bazy ||
    "Brak aktywnej bazy";
  const returnBaseAddress =
    activeReturnSettings?.adres_bazy ||
    operationalSettings?.adres_bazy ||
    "Brak aktywnej bazy";
  const startBaseTitle = selectedStartPointOverride
    ? "Start niestandardowy"
    : "Start z magazynu";
  const returnBaseTitle = "Powrot do magazynu";
  const firstLegLabel = selectedStartPointOverride
    ? "Dojazd z punktu startu do punktu 1"
    : "Dojazd z magazynu do punktu 1";

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
          czasyPostojuMinByReklamacjaId: selectedStopPostojPayload,
          startPointOverride: selectedStartPointOverride,
        }),
      });
      router.push(`/trasy/${response.routeId}`);
    } catch (err) {
      setPreviewError(err.message || "Nie udalo sie utworzyc trasy.");
    } finally {
      setSaving(false);
    }
  }

  function handleCustomStartToggle(nextValue) {
    setUseCustomStartPoint(nextValue);
    setCustomStartPointError("");
    if (!nextValue) {
      setCustomStartPointPreview(null);
    }
  }

  async function handlePreviewCustomStartPoint() {
    const payload = buildStartPointPayload(customStartPointForm);

    if (!payload.kod_pocztowy || !payload.miejscowosc || !payload.adres) {
      setCustomStartPointError(
        "Podaj kod pocztowy, miejscowosc i adres dla niestandardowego startu."
      );
      return;
    }

    try {
      setPreviewComplaint(null);
      setPreviewingStartPoint(true);
      setCustomStartPointError("");
      const previewResponse = await apiFetch("/api/trasy/start-point-preview", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCustomStartPointPreview({
        ...previewResponse,
        confirmed: false,
      });
    } catch (err) {
      setCustomStartPointError(
        err.message || "Nie udalo sie sprawdzic punktu startu."
      );
    } finally {
      setPreviewingStartPoint(false);
    }
  }

  function handleConfirmCustomStartPoint() {
    setCustomStartPointPreview((current) =>
      current
        ? {
            ...current,
            confirmed: true,
          }
        : current
    );
  }

  function addCandidate(candidateId) {
    setPreviewError(null);
    setCzasyPostojuMinByReklamacjaId((current) =>
      current[candidateId]
        ? current
        : {
            ...current,
            [candidateId]: getDefaultStopPostojMinutes(operationalSettings),
          }
    );
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
      const sourceOrder =
        !manualOrder && selectedStops.length
          ? selectedStops.map((stop) => stop.id)
          : current;
      const index = sourceOrder.indexOf(candidateId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= sourceOrder.length) {
        return current;
      }
      const updated = [...sourceOrder];
      [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
      return updated;
    });
  }

  function handleDisableAutoOptimization() {
    setPreviewError(null);
    setManualOrder(true);
    setSelectedIds((current) => {
      const orderedIds = selectedStops.map((stop) => stop.id).filter(Boolean);
      return orderedIds.length ? orderedIds : current;
    });
  }

  function handleStopPostojChange(reklamacjaId, value) {
    if (!`${value ?? ""}`.trim()) {
      return;
    }

    const nextValue = Math.min(
      1440,
      Math.max(
        1,
        normalizeStopPostojMinutes(
          value,
          getDefaultStopPostojMinutes(operationalSettings)
        )
      )
    );

    setPreviewError(null);
    setCzasyPostojuMinByReklamacjaId((current) => ({
      ...current,
      [reklamacjaId]: nextValue,
    }));
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
                placeholder="Opcjonalny komentarz do trasy"
              />
            </label>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-900">
                  Jednorazowy punkt startu
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Trasa moze wystartowac z innego miejsca niz magazyn. Ustawienie
                  dotyczy tylko tej trasy.
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={useCustomStartPoint}
                  onChange={(event) => handleCustomStartToggle(event.target.checked)}
                />
                Uzyj innego startu
              </label>
            </div>

            {useCustomStartPoint ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="text-sm text-slate-700">
                    Kod pocztowy
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
                      value={customStartPointForm.kod_pocztowy}
                      onChange={(event) => {
                        setCustomStartPointForm((current) => ({
                          ...current,
                          kod_pocztowy: event.target.value,
                        }));
                        setCustomStartPointPreview(null);
                        setCustomStartPointError("");
                      }}
                      placeholder="63-600"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    Miejscowosc
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
                      value={customStartPointForm.miejscowosc}
                      onChange={(event) => {
                        setCustomStartPointForm((current) => ({
                          ...current,
                          miejscowosc: event.target.value,
                        }));
                        setCustomStartPointPreview(null);
                        setCustomStartPointError("");
                      }}
                      placeholder="Kepno"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    Adres
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
                      value={customStartPointForm.adres}
                      onChange={(event) => {
                        setCustomStartPointForm((current) => ({
                          ...current,
                          adres: event.target.value,
                        }));
                        setCustomStartPointPreview(null);
                        setCustomStartPointError("");
                      }}
                      placeholder="ul. Magazynowa 1"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handlePreviewCustomStartPoint}
                    disabled={previewingStartPoint || saving}
                  >
                    {previewingStartPoint ? "Sprawdzanie..." : "Sprawdz punkt startu"}
                  </button>

                  {customStartPointPreview?.confirmed ? (
                    <span className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-semibold text-emerald-700">
                      Potwierdzony punkt startu
                    </span>
                  ) : null}
                </div>

                {selectedStartPointOverride ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Start: {selectedStartPointOverride.address}
                  </div>
                ) : null}

                {customStartPointError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {customStartPointError}
                  </div>
                ) : null}
              </div>
            ) : null}
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
                  <span>Kolory kart i znacznikow wynikaja ze statusu reklamacji.</span>
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
                      placeholder="Szukaj po firmie, meblu, kliencie, telefonie, adresie lub numerze reklamacji..."
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
                      const theme = getCandidateTheme(candidate.status);
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
                                {candidate.nazwa_mebla ? (
                                  <div>Nazwa mebla: {candidate.nazwa_mebla}</div>
                                ) : null}
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
                                {profile?.role === ROLE.ADMIN ? (
                                  <PickedUpIndicator
                                    checked={Boolean(candidate.element_odebrany)}
                                    label={
                                      candidate.element_odebrany
                                        ? "Element odebrany"
                                        : "Element nieodebrany"
                                    }
                                  />
                                ) : null}
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
                    Start: {startBaseAddress}
                  </div>
                </div>

                <div className="min-w-0 p-4">
                  <RouteMap
                    base={activeStartSettings}
                    stops={mapStops}
                    encodedPolyline={preview?.encodedPolyline}
                    height="clamp(320px, 60vh, 720px)"
                    overlapMode="coordinates-first"
                    popupVariant="complaint-candidate"
                    showPickedUp={profile?.role === ROLE.ADMIN}
                    onShowStopDetails={(stop) =>
                      !isCustomStartPointConfirmOpen
                        ? setPreviewComplaint(stop.reklamacje || stop)
                        : null
                    }
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
                <div className="flex flex-wrap items-center gap-2">
                  {previewLoading ? (
                    <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">
                      Przeliczanie ETA...
                    </span>
                  ) : null}
                  {manualOrder ? (
                    <>
                      <span className="rounded-full bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-700">
                        Tryb reczny kolejnosci
                      </span>
                      <button
                        type="button"
                        className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        onClick={() => setManualOrder(false)}
                      >
                        Wlacz autooptymalizacje
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-semibold text-emerald-700">
                        Autooptymalizacja wlaczona
                      </span>
                      <button
                        type="button"
                        className="rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                        onClick={handleDisableAutoOptimization}
                      >
                        Wylacz autooptymalizacje
                      </button>
                    </>
                  )}
                </div>
              </div>

              {selectedStops.length ? (
                <div className="mt-5 space-y-1">
                  <RouteBaseCard
                    title={startBaseTitle}
                    address={startBaseAddress}
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
                      label={firstLegLabel}
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
                              {stop.nazwa_mebla ? (
                                <div className="mt-2 text-sm text-slate-600">
                                  Nazwa mebla: {stop.nazwa_mebla}
                                </div>
                              ) : null}
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
                              <RouteStopDurationField
                                value={selectedStopPostojPayload[stop.id]}
                                onChange={(event) =>
                                  handleStopPostojChange(stop.id, event.target.value)
                                }
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
                    title={returnBaseTitle}
                    address={returnBaseAddress}
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
                  <div>Punkt startu: {startBaseAddress}</div>
                  <div>Powrot: {returnBaseAddress}</div>
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

                {useCustomStartPoint && !selectedStartPointOverride ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Aby utworzyc trase, potwierdz najpierw niestandardowy punkt startu.
                  </div>
                ) : null}

                <button
                  type="button"
                  className="mt-6 w-full rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleCreateRoute}
                  disabled={
                    saving ||
                    previewLoading ||
                    !selectedIds.length ||
                    Boolean(previewError) ||
                    !preview ||
                    (useCustomStartPoint && !selectedStartPointOverride)
                  }
                >
                  {saving ? "Tworzenie..." : "Utworz trase"}
                </button>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
                <h2 className="text-xl font-semibold">Statusy kandydatow</h2>
                <div className="mt-5 flex flex-wrap gap-2">
                  <StatusBadge value={REKLAMACJA_STATUS.NEW} />
                  <StatusBadge value={REKLAMACJA_STATUS.UPDATED} />
                  <StatusBadge value={REKLAMACJA_STATUS.IN_PROGRESS} />
                  <StatusBadge value={REKLAMACJA_STATUS.WAITING_DELIVERY} />
                </div>
                <p className="mt-4 text-sm text-slate-600">
                  Kolory kandydatow i znacznikow na mapie sa zgodne ze statusem
                  reklamacji.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <ComplaintPreviewModal
        complaint={previewComplaint}
        showPickedUp={profile?.role === ROLE.ADMIN}
        onClose={() => setPreviewComplaint(null)}
      />

      {isCustomStartPointConfirmOpen ? (
        <div
          className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setCustomStartPointPreview(null)}
        >
          <div
            className="relative my-auto w-full max-w-6xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl max-h-[calc(100vh-2rem)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Potwierdzenie punktu startu trasy"
          >
            <button
              type="button"
              className="absolute right-4 top-4 z-10 rounded-full bg-white/95 p-2 text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-950"
              onClick={() => setCustomStartPointPreview(null)}
              aria-label="Zamknij podglad punktu startu"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr),380px]">
              <div className="bg-slate-50 p-4">
                <RouteMap
                  height="480px"
                  singlePointMaxZoom={15}
                  showPickedUp={profile?.role === ROLE.ADMIN}
                  stops={[
                    {
                      id: "route-start-point-preview",
                      lat: customStartPointPreview.geocode.lat,
                      lon: customStartPointPreview.geocode.lon,
                      nazwa_firmy:
                        customStartPointPreview.geocode.matchType === "approximate"
                          ? "Przyblizony punkt startu"
                          : "Punkt startu trasy",
                      miejscowosc: customStartPointPreview.requestedAddress?.town,
                      adres: customStartPointPreview.geocode.formattedAddress,
                      tone:
                        customStartPointPreview.geocode.matchType === "approximate"
                          ? "yellow"
                          : "blue",
                    },
                  ]}
                />
              </div>

              <div className="border-t border-slate-200 p-6 lg:border-l lg:border-t-0">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 rounded-full p-2 ${
                      customStartPointPreview.geocode.matchType === "approximate"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {customStartPointPreview.geocode.matchType === "approximate" ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                  </div>

                  <div>
                    <div className="text-xl font-semibold text-slate-950">
                      {customStartPointPreview.geocode.matchType === "approximate"
                        ? "Sprawdz przyblizony punkt startu"
                        : "Potwierdz punkt startu"}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {customStartPointPreview.geocode.matchType === "approximate"
                        ? "Google wskazal punkt przyblizony. Potwierdz go tylko, jesli pinezka pokazuje poprawne miejsce."
                        : "Adres punktu startu zostal odnaleziony dokladnie."}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4 text-sm text-slate-700">
                  <div className="rounded-[1.5rem] bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Wpisany adres
                    </div>
                    <div className="mt-2 flex items-start gap-2 text-slate-900">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                      <span>{formatAddressLabel(customStartPointPreview.requestedAddress)}</span>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Znaleziony adres
                    </div>
                    <div className="mt-2 font-medium text-slate-900">
                      {customStartPointPreview.geocode.formattedAddress}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Typ wyniku: {customStartPointPreview.geocode.locationType || "brak"}
                    </div>
                  </div>

                  {customStartPointPreview.geocode.warnings?.length ? (
                    <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                        Ostrzezenia dopasowania
                      </div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">
                        {customStartPointPreview.geocode.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    onClick={handleConfirmCustomStartPoint}
                  >
                    Uzyj tego punktu startu
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                    onClick={() => setCustomStartPointPreview(null)}
                  >
                    Wroc do edycji adresu
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

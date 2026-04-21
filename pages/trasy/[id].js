import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { ScreenState } from "@/components/layout/ScreenState";
import { StatusBadge } from "@/components/StatusBadge";
import ComplaintCloseModal from "@/components/reklamacje/ComplaintCloseModal";
import RouteRecalculateModal from "@/components/trasy/RouteRecalculateModal";
import RouteSmsStatusControl from "@/components/trasy/RouteSmsStatusControl";
import RouteStopsList from "@/components/trasy/RouteStopsList";
import { RouteStopDurationField } from "@/components/trasy/RouteTiming";
import {
  ROLE,
  ROUTE_STATUS,
  ROUTE_STOP_FINAL_STATUSES,
  SMS_CONFIRMATION_STATUS,
} from "@/lib/constants";
import { apiFetch } from "@/lib/client-api";
import { useCurrentProfile } from "@/lib/use-current-profile";
import {
  formatDate,
  formatDistance,
  formatDuration,
  getRouteDisplayName,
  labelForStatus,
  labelForOperationalAction,
  safeArray,
} from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const RouteMap = dynamic(() => import("@/components/maps/RouteMap"), {
  ssr: false,
});

function toDateTimeLocalValue(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 16);
}

function areOrderedIdsEqual(left = [], right = []) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function areStopPostojMapsEqual(reklamacjeIds = [], left = {}, right = {}) {
  return reklamacjeIds.every(
    (reklamacjaId) => Number(left[reklamacjaId]) === Number(right[reklamacjaId])
  );
}

function normalizeStopPostojMinutes(value, fallbackMinutes) {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 1440) {
    return parsed;
  }

  return fallbackMinutes;
}

function buildFeedback(tone, text) {
  return text ? { tone, text } : null;
}

export default function RouteDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { profile, loading, error } = useCurrentProfile();
  const [detail, setDetail] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [orderedIds, setOrderedIds] = useState([]);
  const [planowanyStartAt, setPlanowanyStartAt] = useState("");
  const [czasyPostojuMinByReklamacjaId, setCzasyPostojuMinByReklamacjaId] =
    useState({});
  const [closeTargetStopId, setCloseTargetStopId] = useState(null);
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [recalculateModalOpen, setRecalculateModalOpen] = useState(false);
  const [editPreview, setEditPreview] = useState(null);
  const [editPreviewLoading, setEditPreviewLoading] = useState(false);
  const [editPreviewError, setEditPreviewError] = useState(null);
  const [feedback, setFeedback] = useState(null);

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
        setDetail(response);
        setOrderedIds((response.stops || []).map((stop) => stop.reklamacja_id));
        setPlanowanyStartAt(toDateTimeLocalValue(response.route?.planowany_start_at));
        setCzasyPostojuMinByReklamacjaId(
          Object.fromEntries(
            (response.stops || []).map((stop) => [stop.reklamacja_id, stop.czas_postoju_min])
          )
        );
        setIsEditingRoute(false);
        setEditPreview(null);
        setEditPreviewError(null);
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

  const originalOrderedIds = useMemo(
    () => (detail?.stops || []).map((stop) => stop.reklamacja_id),
    [detail?.stops]
  );
  const originalStopPostojMap = useMemo(
    () =>
      Object.fromEntries(
        (detail?.stops || []).map((stop) => [stop.reklamacja_id, stop.czas_postoju_min])
      ),
    [detail?.stops]
  );
  const currentStopPostojPayload = useMemo(
    () =>
      Object.fromEntries(
        orderedIds.map((reklamacjaId) => [
          reklamacjaId,
          normalizeStopPostojMinutes(
            czasyPostojuMinByReklamacjaId[reklamacjaId],
            originalStopPostojMap[reklamacjaId]
          ),
        ])
      ),
    [czasyPostojuMinByReklamacjaId, orderedIds, originalStopPostojMap]
  );

  const orderedStops = useMemo(() => {
    if (!detail?.stops?.length) return [];

    return orderedIds
      .map((reklamacjaId) =>
        detail.stops.find((stop) => stop.reklamacja_id === reklamacjaId)
      )
      .filter(Boolean);
  }, [detail?.stops, orderedIds]);

  useEffect(() => {
    if (!isEditingRoute) {
      setEditPreview(null);
      setEditPreviewError(null);
      setEditPreviewLoading(false);
      return;
    }

    if (!orderedIds.length || !planowanyStartAt) {
      setEditPreview(null);
      setEditPreviewError(null);
      setEditPreviewLoading(false);
      return;
    }

    let active = true;
    const timeoutId = setTimeout(async () => {
      try {
        setEditPreviewLoading(true);
        const response = await apiFetch("/api/trasy", {
          method: "POST",
          body: JSON.stringify({
            dryRun: true,
            reklamacjeIds: orderedIds,
            planowanyStartAt: new Date(planowanyStartAt).toISOString(),
            optimize: false,
            czasyPostojuMinByReklamacjaId: currentStopPostojPayload,
          }),
        });

        if (!active) {
          return;
        }

        setEditPreview(response);
        setEditPreviewError(null);
      } catch (err) {
        if (!active) {
          return;
        }

        setEditPreview(null);
        setEditPreviewError(err.message || "Nie udalo sie przeliczyc trasy.");
      } finally {
        if (active) {
          setEditPreviewLoading(false);
        }
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [currentStopPostojPayload, isEditingRoute, orderedIds, planowanyStartAt]);

  const editingPreviewStops = useMemo(() => {
    if (!isEditingRoute) {
      return [];
    }

    const previewStopMap = new Map(
      (editPreview?.orderedStops || []).map((stop) => [stop.id, stop])
    );

    return orderedIds
      .map((reklamacjaId, index) => {
        const previewStop = previewStopMap.get(reklamacjaId);

        if (previewStop) {
          return {
            ...previewStop,
            reklamacja_id: reklamacjaId,
            kolejnosc: index + 1,
            status: "planned",
            czas_postoju_min: currentStopPostojPayload[reklamacjaId],
          };
        }

        const currentStop = orderedStops.find(
          (stop) => stop.reklamacja_id === reklamacjaId
        );

        if (!currentStop) {
          return null;
        }

        return {
          ...currentStop,
          kolejnosc: index + 1,
          czas_postoju_min: currentStopPostojPayload[reklamacjaId],
        };
      })
      .filter(Boolean);
  }, [
    currentStopPostojPayload,
    editPreview?.orderedStops,
    isEditingRoute,
    orderedIds,
    orderedStops,
  ]);
  const pendingBatchConfirmationStopsCount = useMemo(
    () =>
      orderedStops.filter(
        (stop) => stop.smsConfirmationStatus === SMS_CONFIRMATION_STATUS.NOT_SENT
      ).length,
    [orderedStops]
  );

  const closeTargetStop = useMemo(
    () => orderedStops.find((stop) => stop.id === closeTargetStopId) || null,
    [closeTargetStopId, orderedStops]
  );

  const canEditRoute =
    detail?.route?.status === ROUTE_STATUS.PLANNED && detail?.stops?.length > 0;
  const canStart =
    detail?.route?.status === ROUTE_STATUS.PLANNED &&
    detail?.stops?.length > 0 &&
    !isEditingRoute;
  const canComplete =
    detail?.route?.status === ROUTE_STATUS.IN_PROGRESS &&
    detail?.stops?.length > 0 &&
    detail?.stops?.every((stop) => ROUTE_STOP_FINAL_STATUSES.includes(stop.status));
  const canSendBatchConfirmationSms =
    detail?.route?.status === ROUTE_STATUS.PLANNED &&
    !isEditingRoute &&
    pendingBatchConfirmationStopsCount > 0;
  const displayStops = isEditingRoute ? editingPreviewStops : orderedStops;
  const routeStartBaseAddress =
    (isEditingRoute
      ? editPreview?.startBase?.adres_bazy ||
        editPreview?.base?.adres_bazy ||
        editPreview?.settings?.adres_bazy
      : null) ||
    detail?.mapStartBase?.adres_bazy ||
    detail?.mapBase?.adres_bazy ||
    detail?.route?.base_address_snapshot ||
    "Brak adresu magazynu";
  const routeReturnBaseAddress =
    (isEditingRoute
      ? editPreview?.returnBase?.adres_bazy || editPreview?.settings?.adres_bazy
      : null) ||
    detail?.mapReturnBase?.adres_bazy ||
    detail?.route?.return_base_address_snapshot ||
    detail?.route?.base_address_snapshot ||
    "Brak adresu magazynu";
  const displayDistanceMeters =
    isEditingRoute && editPreview
      ? editPreview.totalDistanceMeters
      : detail?.route?.total_distance_m;
  const displayDurationSeconds =
    isEditingRoute && editPreview
      ? editPreview.totalDurationSeconds
      : detail?.route?.total_duration_s;
  const displayEncodedPolyline =
    isEditingRoute && editPreview ? editPreview.encodedPolyline : detail?.encodedPolyline;
  const displayReturnLegDurationSeconds =
    isEditingRoute && editPreview
      ? editPreview.returnLegDurationSeconds
      : detail?.returnLegDurationSeconds;
  const displayReturnEtaAt =
    isEditingRoute && editPreview ? editPreview.returnEtaAt : detail?.returnEtaAt;
  const routeEdited =
    isEditingRoute &&
    (!areOrderedIdsEqual(orderedIds, originalOrderedIds) ||
      planowanyStartAt !== toDateTimeLocalValue(detail?.route?.planowany_start_at) ||
      !areStopPostojMapsEqual(
        orderedIds,
        currentStopPostojPayload,
        originalStopPostojMap
      ));

  async function refresh({ preserveEditing = false } = {}) {
    const response = await apiFetch(`/api/trasy/${id}`);
    setLoadError(null);
    setDetail(response);
    setOrderedIds((response.stops || []).map((stop) => stop.reklamacja_id));
    setPlanowanyStartAt(toDateTimeLocalValue(response.route?.planowany_start_at));
    setCzasyPostojuMinByReklamacjaId(
      Object.fromEntries(
        (response.stops || []).map((stop) => [stop.reklamacja_id, stop.czas_postoju_min])
      )
    );
    if (!preserveEditing) {
      setIsEditingRoute(false);
      setEditPreview(null);
      setEditPreviewError(null);
    }
  }

  function move(reklamacjaId, direction) {
    setOrderedIds((current) => {
      const index = current.indexOf(reklamacjaId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function remove(reklamacjaId) {
    setOrderedIds((current) => current.filter((item) => item !== reklamacjaId));
  }

  function handleEnableEditing() {
    setFeedback(null);
    setEditPreviewError(null);
    setOrderedIds(originalOrderedIds);
    setPlanowanyStartAt(toDateTimeLocalValue(detail?.route?.planowany_start_at));
    setCzasyPostojuMinByReklamacjaId(originalStopPostojMap);
    setIsEditingRoute(true);
  }

  function handleCancelEditing() {
    setFeedback(null);
    setEditPreview(null);
    setEditPreviewError(null);
    setOrderedIds(originalOrderedIds);
    setPlanowanyStartAt(toDateTimeLocalValue(detail?.route?.planowany_start_at));
    setCzasyPostojuMinByReklamacjaId(originalStopPostojMap);
    setIsEditingRoute(false);
    setRecalculateModalOpen(false);
  }

  function handleStopPostojChange(reklamacjaId, value) {
    if (!`${value ?? ""}`.trim()) {
      return;
    }

    const nextValue = Math.min(
      1440,
      Math.max(
        1,
        normalizeStopPostojMinutes(value, originalStopPostojMap[reklamacjaId])
      )
    );

    setFeedback(null);
    setEditPreviewError(null);
    setCzasyPostojuMinByReklamacjaId((current) => ({
      ...current,
      [reklamacjaId]: nextValue,
    }));
  }

  async function handleRecalculateConfirm({ resetSmsConfirmations }) {
    try {
      setSaving(true);
      await apiFetch(`/api/trasy/${id}/recalculate`, {
        method: "POST",
        body: JSON.stringify({
          reklamacjeIds: orderedIds,
          planowanyStartAt: new Date(planowanyStartAt).toISOString(),
          resetSmsConfirmations,
          czasyPostojuMinByReklamacjaId: currentStopPostojPayload,
        }),
      });
      await refresh();
      setRecalculateModalOpen(false);
      setFeedback(
        buildFeedback(
          "success",
          resetSmsConfirmations
            ? "Zmiany trasy zapisane. Potwierdzenia SMS zostaly zresetowane."
            : "Zmiany trasy zostaly zapisane."
        )
      );
    } catch (err) {
      setFeedback(
        buildFeedback(
          "error",
          err.message || "Nie udalo sie zapisac zmian trasy."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStart() {
    try {
      setSaving(true);
      const response = await apiFetch(`/api/trasy/${id}/start`, { method: "POST" });
      await refresh();

      if (response?.warnings?.length) {
        setFeedback(
          buildFeedback(
            "warning",
            `Trasa wystartowala, ale czesc SMS nie zostala wyslana: ${response.warnings.join(
              " | "
            )}`
          )
        );
      } else {
        setFeedback(buildFeedback("success", "Trasa zostala wystartowana."));
      }
    } catch (err) {
      setFeedback(
        buildFeedback("error", err.message || "Nie udalo sie wystartowac trasy.")
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSendBatchConfirmationSms() {
    try {
      setSaving(true);
      const response = await apiFetch(`/api/trasy/${id}/sms-confirmations/send`, {
        method: "POST",
      });
      await refresh();

      const summary = `Wyslano ${response.sentCount}/${response.totalCount} SMS potwierdzen dla punktow z szara lampka.`;
      if (response?.warnings?.length) {
        setFeedback(
          buildFeedback("warning", `${summary} Ostrzezenia: ${response.warnings.join(" | ")}`)
        );
      } else {
        setFeedback(buildFeedback("success", summary));
      }
    } catch (err) {
      setFeedback(
        buildFeedback(
          "error",
          err.message || "Nie udalo sie wyslac zbiorczych SMS potwierdzen."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSendSingleConfirmationSms(stop) {
    try {
      setSaving(true);
      const response = await apiFetch(
        `/api/trasy/${id}/stops/${stop.id}/sms-confirmation/send`,
        {
          method: "POST",
        }
      );
      await refresh();

      if (response?.warnings?.length) {
        setFeedback(
          buildFeedback(
            "warning",
            `SMS dla punktu ${stop.kolejnosc} wyslany. Ostrzezenia: ${response.warnings.join(
              " | "
            )}`
          )
        );
      } else {
        setFeedback(
          buildFeedback("success", `SMS dla punktu ${stop.kolejnosc} zostal wyslany.`)
        );
      }
    } catch (err) {
      setFeedback(
        buildFeedback("error", err.message || "Nie udalo sie wyslac SMS dla punktu.")
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSmsStatusChange(stop, status) {
    try {
      setSaving(true);
      await apiFetch(
        `/api/trasy/${id}/stops/${stop.id}/sms-confirmation/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      );
      await refresh({ preserveEditing: false });
      setFeedback(
        buildFeedback(
          "success",
          `Zmieniono lampke SMS punktu ${stop.kolejnosc} na ${labelForStatus(
            status
          )}.`
        )
      );
    } catch (err) {
      setFeedback(
        buildFeedback(
          "error",
          err.message || "Nie udalo sie zmienic statusu lampki SMS."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeliverSubmit(payload) {
    if (!closeTargetStop) {
      return;
    }

    setSaving(true);

    try {
      await apiFetch(`/api/trasy/${id}/stops/${closeTargetStop.id}/deliver`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCloseTargetStopId(null);
      await refresh();
      setFeedback(buildFeedback("success", "Punkt zostal oznaczony jako dostarczony."));
    } catch (error) {
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    try {
      setSaving(true);
      await apiFetch(`/api/trasy/${id}/complete`, { method: "POST" });
      await refresh();
      setFeedback(buildFeedback("success", "Trasa zostala zakonczona."));
    } catch (err) {
      setFeedback(
        buildFeedback("error", err.message || "Nie udalo sie ukonczyc trasy.")
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

  return (
    <>
      <AppShell
        profile={profile}
        title={getRouteDisplayName(detail?.route)}
        subtitle="Szczegoly trasy, kolejnosc punktow, logi operacyjne i powiadomienia SMS dla klienta."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/trasy"
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Wroc do tras
            </Link>
            {canSendBatchConfirmationSms ? (
              <button
                type="button"
                className="rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleSendBatchConfirmationSms}
                disabled={saving}
              >
                Wyslij SMS dla szarych
              </button>
            ) : null}
            {canEditRoute && !isEditingRoute ? (
              <button
                type="button"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                onClick={handleEnableEditing}
              >
                Edytuj trase
              </button>
            ) : null}
            {isEditingRoute ? (
              <button
                type="button"
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                onClick={handleCancelEditing}
              >
                Anuluj edycje
              </button>
            ) : null}
            {canStart ? (
              <button
                type="button"
                className="rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
                onClick={handleStart}
                disabled={saving}
              >
                Start trasy
              </button>
            ) : null}
            {canComplete ? (
              <button
                type="button"
                className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
                onClick={handleComplete}
                disabled={saving}
              >
                Ukoncz trase
              </button>
            ) : null}
          </div>
        }
        fullWidth
      >
        {loadError ? (
          <ScreenState title="Nie udalo sie wczytac trasy" description={loadError} />
        ) : !detail ? (
          <ScreenState
            title="Ladowanie trasy"
            description="Pobieram szczegoly i punkty trasy."
          />
        ) : (
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.2fr),420px] xl:gap-8">
            <section className="min-w-0 space-y-6 sm:space-y-8">
              {feedback ? (
                <div
                  className={`rounded-[1.75rem] px-5 py-4 text-sm shadow-sm ${
                    feedback.tone === "error"
                      ? "border border-rose-200 bg-rose-50 text-rose-700"
                      : feedback.tone === "warning"
                        ? "border border-amber-200 bg-amber-50 text-amber-800"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {feedback.text}
                </div>
              ) : null}

              {isEditingRoute && editPreviewError ? (
                <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
                  {editPreviewError}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-slate-500">Status</div>
                  <div className="mt-3">
                    <StatusBadge value={detail.route.status} />
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-slate-500">Data trasy</div>
                  <div className="mt-3 text-2xl font-bold text-slate-950">
                    {formatDate(detail.route.data_trasy)}
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-slate-500">Dystans</div>
                  <div className="mt-3 text-2xl font-bold text-slate-950">
                    {formatDistance(displayDistanceMeters)}
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-slate-500">Czas przejazdu</div>
                  <div className="mt-3 text-2xl font-bold text-slate-950">
                    {formatDuration(displayDurationSeconds)}
                  </div>
                </div>
              </div>

              <RouteMap
                base={
                  isEditingRoute
                    ? editPreview?.startBase ||
                      editPreview?.base ||
                      editPreview?.settings
                    : detail.mapStartBase || detail.mapBase
                }
                stops={displayStops.map((stop, index) => {
                  const complaint = stop.reklamacje || stop;

                  return {
                    id: stop.id,
                    lat: complaint.lat,
                    lon: complaint.lon,
                    nazwa_firmy: complaint.nazwa_firmy,
                    nazwa_mebla: complaint.nazwa_mebla,
                    imie_klienta: complaint.imie_klienta,
                    nazwisko_klienta: complaint.nazwisko_klienta,
                    telefon_klienta: complaint.telefon_klienta,
                    adres: complaint.adres,
                    miejscowosc: complaint.miejscowosc,
                    kod_pocztowy: complaint.kod_pocztowy,
                    order: stop.kolejnosc || index + 1,
                    status: stop.status,
                    eta_from: stop.eta_from,
                    eta_to: stop.eta_to,
                  };
                })}
                encodedPolyline={displayEncodedPolyline}
                height="clamp(280px, 42vh, 540px)"
                showPickedUp={profile?.role === ROLE.ADMIN}
              />

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                      Punkty trasy
                    </h2>
                    {detail.route.smsConfirmationsSentAt ? (
                      <div className="mt-2 text-sm text-amber-700">
                        Ostatnia wysylka zbiorcza SMS:{" "}
                        {formatDate(detail.route.smsConfirmationsSentAt, true)}
                      </div>
                    ) : null}
                  </div>

                  {isEditingRoute ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                      {editPreviewLoading ? (
                        <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">
                          Przeliczanie ETA...
                        </div>
                      ) : null}
                      <input
                        type="datetime-local"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm sm:w-auto"
                        value={planowanyStartAt}
                        onChange={(event) => setPlanowanyStartAt(event.target.value)}
                      />
                      <button
                        type="button"
                        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => setRecalculateModalOpen(true)}
                        disabled={
                          saving ||
                          editPreviewLoading ||
                          Boolean(editPreviewError) ||
                          !routeEdited ||
                          !orderedIds.length
                        }
                      >
                        Zapisz zmiany trasy
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-6">
                  <RouteStopsList
                    stops={displayStops}
                    routeStartAddress={routeStartBaseAddress}
                    routeReturnAddress={routeReturnBaseAddress}
                    plannedStartAt={
                      isEditingRoute
                        ? new Date(planowanyStartAt).toISOString()
                        : detail.route.planowany_start_at
                    }
                    returnLegDurationSeconds={displayReturnLegDurationSeconds}
                    returnEtaAt={displayReturnEtaAt}
                    renderPhoneAccessory={(stop) =>
                      isEditingRoute ? null : (
                        <RouteSmsStatusControl
                          status={stop.smsConfirmationStatus}
                          disabled={saving}
                          loading={saving}
                          onChange={(nextStatus) =>
                            handleSmsStatusChange(stop, nextStatus)
                          }
                        />
                      )
                    }
                    renderTimingAccessory={(stop) =>
                      isEditingRoute ? (
                        <RouteStopDurationField
                          value={currentStopPostojPayload[stop.reklamacja_id]}
                          onChange={(event) =>
                            handleStopPostojChange(
                              stop.reklamacja_id,
                              event.target.value
                            )
                          }
                          disabled={saving}
                          className="w-full sm:w-[220px]"
                        />
                      ) : null
                    }
                    renderPointActions={(stop) => (
                      <>
                        {isEditingRoute ? (
                          <>
                            <button
                              type="button"
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                              onClick={() => move(stop.reklamacja_id, -1)}
                            >
                              W gore
                            </button>
                            <button
                              type="button"
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                              onClick={() => move(stop.reklamacja_id, 1)}
                            >
                              W dol
                            </button>
                            <button
                              type="button"
                              className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
                              onClick={() => remove(stop.reklamacja_id)}
                            >
                              Usun
                            </button>
                          </>
                        ) : null}

                        {detail.route.status === ROUTE_STATUS.PLANNED && !isEditingRoute ? (
                          <button
                            type="button"
                            className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                            onClick={() => handleSendSingleConfirmationSms(stop)}
                          >
                            {stop.smsConfirmationStatus === SMS_CONFIRMATION_STATUS.NOT_SENT
                              ? "Wyslij SMS"
                              : "Wyslij ponownie"}
                          </button>
                        ) : null}

                        {detail.route.status === ROUTE_STATUS.IN_PROGRESS &&
                        !ROUTE_STOP_FINAL_STATUSES.includes(stop.status) ? (
                          <button
                            type="button"
                            className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                            onClick={() => setCloseTargetStopId(stop.id)}
                          >
                            Dostarczone
                          </button>
                        ) : null}
                      </>
                    )}
                    highlightedStopId={closeTargetStopId}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-950">Logi trasy</h2>
                {detail.logs.length ? (
                  <div className="mt-4 overflow-x-auto">
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
                  <p className="mt-4 text-slate-500">Brak logow dla tej trasy.</p>
                )}
              </div>
            </section>

            <aside className="min-w-0 space-y-6 sm:space-y-8">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-950">
                  Metryki trasy
                </h2>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <div>Nazwa trasy: {detail.route.nazwa || "Brak nazwy wlasnej"}</div>
                  <div>Numer trasy: {detail.route.numer}</div>
                  <div>
                    Start:{" "}
                    {formatDate(
                      isEditingRoute
                        ? new Date(planowanyStartAt).toISOString()
                        : detail.route.planowany_start_at,
                      true
                    )}
                  </div>
                  <div>Punkt startu: {routeStartBaseAddress}</div>
                  <div>Powrot: {routeReturnBaseAddress}</div>
                  <div>Notatki: {detail.route.notes || "-"}</div>
                  <div>Punkty: {displayStops.length}</div>
                  <div>
                    Ostatnia wysylka zbiorcza SMS:{" "}
                    {detail.route.smsConfirmationsSentAt
                      ? formatDate(detail.route.smsConfirmationsSentAt, true)
                      : "brak"}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </AppShell>

      <ComplaintCloseModal
        isOpen={Boolean(closeTargetStop)}
        mode="deliver"
        initialValue={{
          informacje: closeTargetStop?.reklamacje?.informacje || "",
          opis_przebiegu: closeTargetStop?.reklamacje?.opis_przebiegu || "",
          zalacznik_pdf_zakonczenie:
            closeTargetStop?.reklamacje?.zalacznik_pdf_zakonczenie || null,
          zalacznik_zakonczenie: safeArray(
            closeTargetStop?.reklamacje?.zalacznik_zakonczenie
          ),
        }}
        onClose={() => {
          if (!saving) {
            setCloseTargetStopId(null);
          }
        }}
        onSubmit={handleDeliverSubmit}
      />

      <RouteRecalculateModal
        isOpen={recalculateModalOpen}
        routeName={getRouteDisplayName(detail?.route)}
        pointCount={orderedIds.length}
        plannedStartAt={
          planowanyStartAt ? new Date(planowanyStartAt).toISOString() : null
        }
        loading={saving}
        onClose={() => {
          if (!saving) {
            setRecalculateModalOpen(false);
          }
        }}
        onConfirm={handleRecalculateConfirm}
      />
    </>
  );
}

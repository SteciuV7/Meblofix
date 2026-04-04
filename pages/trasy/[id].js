import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { ScreenState } from "@/components/layout/ScreenState";
import { StatusBadge } from "@/components/StatusBadge";
import { ROLE, ROUTE_STATUS } from "@/lib/constants";
import { apiFetch } from "@/lib/client-api";
import { useCurrentProfile } from "@/lib/use-current-profile";
import {
  formatDate,
  formatDistance,
  formatDuration,
  getRouteDisplayName,
} from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const RouteMap = dynamic(() => import("@/components/maps/RouteMap"), {
  ssr: false,
});

export default function RouteDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { profile, loading, error } = useCurrentProfile();
  const [detail, setDetail] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [orderedIds, setOrderedIds] = useState([]);
  const [planowanyStartAt, setPlanowanyStartAt] = useState("");

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
        setPlanowanyStartAt(
          response.route?.planowany_start_at
            ? new Date(response.route.planowany_start_at).toISOString().slice(0, 16)
            : ""
        );
      } catch (err) {
        if (!active) return;
        setLoadError(err.message || "Nie udało się pobrać trasy.");
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [id, profile, router]);

  const orderedStops = useMemo(() => {
    if (!detail?.stops?.length) return [];
    return orderedIds
      .map((reklamacjaId) =>
        detail.stops.find((stop) => stop.reklamacja_id === reklamacjaId)
      )
      .filter(Boolean);
  }, [detail?.stops, orderedIds]);

  const canRecalculate =
    detail?.route?.status === ROUTE_STATUS.PLANNED && orderedIds.length > 0;
  const canStart =
    detail?.route?.status === ROUTE_STATUS.PLANNED && detail?.stops?.length > 0;
  const canComplete =
    detail?.route?.status === ROUTE_STATUS.IN_PROGRESS &&
    detail?.stops?.every((stop) => stop.status === "delivered");

  async function refresh() {
    const response = await apiFetch(`/api/trasy/${id}`);
    setLoadError(null);
    setDetail(response);
    setOrderedIds((response.stops || []).map((stop) => stop.reklamacja_id));
    setPlanowanyStartAt(
      response.route?.planowany_start_at
        ? new Date(response.route.planowany_start_at).toISOString().slice(0, 16)
        : ""
    );
  }

  function move(reklamacjaId, direction) {
    setOrderedIds((current) => {
      const index = current.indexOf(reklamacjaId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const updated = [...current];
      [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
      return updated;
    });
  }

  function remove(reklamacjaId) {
    setOrderedIds((current) => current.filter((id) => id !== reklamacjaId));
  }

  async function handleRecalculate() {
    try {
      setSaving(true);
      await apiFetch(`/api/trasy/${id}/recalculate`, {
        method: "POST",
        body: JSON.stringify({
          reklamacjeIds: orderedIds,
          planowanyStartAt: new Date(planowanyStartAt).toISOString(),
        }),
      });
      await refresh();
    } catch (err) {
      alert(err.message || "Nie udało się przeliczyć trasy.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStart() {
    try {
      setSaving(true);
      await apiFetch(`/api/trasy/${id}/start`, { method: "POST" });
      await refresh();
    } catch (err) {
      alert(err.message || "Nie udało się wystartować trasy.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeliver(stopId) {
    try {
      setSaving(true);
      await apiFetch(`/api/trasy/${id}/stops/${stopId}/deliver`, {
        method: "POST",
      });
      await refresh();
    } catch (err) {
      alert(err.message || "Nie udało się oznaczyć punktu jako dostarczony.");
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    try {
      setSaving(true);
      await apiFetch(`/api/trasy/${id}/complete`, { method: "POST" });
      await refresh();
    } catch (err) {
      alert(err.message || "Nie udało się ukończyć trasy.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        Ładowanie...
      </div>
    );
  }

  if (!profile || profile.role !== ROLE.ADMIN) {
    return null;
  }

  return (
    <AppShell
      profile={profile}
      title={getRouteDisplayName(detail?.route)}
      subtitle="Szczegóły trasy, kolejność punktów, logi operacyjne i akcje kierowcy."
      actions={
        <div className="flex flex-wrap gap-3">
          <Link
            href="/trasy"
            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Wróć do tras
          </Link>
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
              Ukończ trasę
            </button>
          ) : null}
        </div>
      }
      fullWidth
    >
      {loadError ? (
        <ScreenState title="Nie udało się wczytać trasy" description={loadError} />
      ) : !detail ? (
        <ScreenState title="Ładowanie trasy" description="Pobieram szczegóły i punkty trasy." />
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr),420px]">
          <section className="space-y-8">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  {formatDistance(detail.route.total_distance_m)}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">Czas przejazdu</div>
                <div className="mt-3 text-2xl font-bold text-slate-950">
                  {formatDuration(detail.route.total_duration_s)}
                </div>
              </div>
            </div>

            <RouteMap
              stops={orderedStops.map((stop) => ({
                id: stop.id,
                lat: stop.reklamacje.lat,
                lon: stop.reklamacje.lon,
                nazwa_firmy: stop.reklamacje.nazwa_firmy,
                adres: stop.reklamacje.adres,
                miejscowosc: stop.reklamacje.miejscowosc,
                kod_pocztowy: stop.reklamacje.kod_pocztowy,
                status: stop.status,
                eta_from: stop.eta_from,
                eta_to: stop.eta_to,
              }))}
              height="540px"
            />

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-slate-950">Punkty trasy</h2>
                {canRecalculate ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="datetime-local"
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      value={planowanyStartAt}
                      onChange={(event) => setPlanowanyStartAt(event.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                      onClick={handleRecalculate}
                      disabled={saving}
                    >
                      Przelicz trasę
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 space-y-4">
                {orderedStops.map((stop, index) => (
                  <div
                    key={stop.id}
                    className="rounded-3xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-sm text-slate-500">Punkt {index + 1}</div>
                        <div className="font-semibold text-slate-950">
                          {stop.reklamacje.nazwa_firmy}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {stop.reklamacje.miejscowosc}, {stop.reklamacje.adres}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <StatusBadge value={stop.status} />
                          <StatusBadge value={stop.reklamacje.status} />
                          <Link
                            href={`/reklamacje/${stop.reklamacja_id}`}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            Reklamacja
                          </Link>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          ETA: {formatDate(stop.eta_from, true)} - {formatDate(stop.eta_to, true)}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {canRecalculate ? (
                          <>
                            <button
                              type="button"
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                              onClick={() => move(stop.reklamacja_id, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                              onClick={() => move(stop.reklamacja_id, 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
                              onClick={() => remove(stop.reklamacja_id)}
                            >
                              Usuń
                            </button>
                          </>
                        ) : null}
                        {detail.route.status === ROUTE_STATUS.IN_PROGRESS &&
                        stop.status !== "delivered" ? (
                          <button
                            type="button"
                            className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                            onClick={() => handleDeliver(stop.id)}
                          >
                            Dostarczone
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
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
                          <td className="px-3 py-3">{formatDate(log.created_at, true)}</td>
                          <td className="px-3 py-3">{log.action}</td>
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
                <p className="mt-4 text-slate-500">Brak logów dla tej trasy.</p>
              )}
            </div>
          </section>

          <aside className="space-y-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">Metryki i kierowca</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div>Nazwa trasy: {detail.route.nazwa || "Brak nazwy wlasnej"}</div>
                <div>Numer trasy: {detail.route.numer}</div>
                <div>Start: {formatDate(detail.route.planowany_start_at, true)}</div>
                <div>Baza: {detail.route.base_address_snapshot || "—"}</div>
                <div>
                  Kierowca:{" "}
                  {detail.route.driver?.nazwa_firmy || detail.route.driver?.email || "—"}
                </div>
                <div>Notatki: {detail.route.notes || "—"}</div>
                <div>Punkty: {detail.stops.length}</div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}

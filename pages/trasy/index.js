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
import { CirclePlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function RoutesListPage() {
  const router = useRouter();
  const { profile, loading, error } = useCurrentProfile();
  const [routes, setRoutes] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    statuses: "",
  });

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
        const query = new URLSearchParams();
        if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) query.set("dateTo", filters.dateTo);
        if (filters.statuses) query.set("statuses", filters.statuses);
        const response = await apiFetch(`/api/trasy?${query.toString()}`);
        if (!active) return;
        setRoutes(response.routes || []);
        setLoadError(null);
      } catch (err) {
        if (!active) return;
        setLoadError(err.message || "Nie udalo sie pobrac tras.");
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [filters, profile, router]);

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
      title="Lista tras"
      subtitle="Centralny widok zaplanowanych, rozpoczetych i ukonczonych tras."
      actions={
        <Link
          href="/trasy/nowa"
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-emerald-500"
        >
          <CirclePlus className="h-4 w-4" />
          Utworz trase
        </Link>
      }
      fullWidth
    >
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="text-sm text-slate-700">
            Data od
            <input
              type="date"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={filters.dateFrom}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
            />
          </label>
          <label className="text-sm text-slate-700">
            Data do
            <input
              type="date"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={filters.dateTo}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
            />
          </label>
          <label className="text-sm text-slate-700">
            Status
            <select
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={filters.statuses}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  statuses: event.target.value,
                }))
              }
            >
              <option value="">Wszystkie</option>
              {Object.values(ROUTE_STATUS).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="mt-8">
        {loadError ? (
          <ScreenState title="Blad ladowania tras" description={loadError} />
        ) : routes.length ? (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Trasa</th>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Start</th>
                    <th className="px-4 py-3 font-medium">Dystans</th>
                    <th className="px-4 py-3 font-medium">Czas</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route) => (
                    <tr key={route.id} className="border-t border-slate-200">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900">
                          {getRouteDisplayName(route)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {route.numer}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatDate(route.data_trasy)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatDate(route.planowany_start_at, true)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatDistance(route.total_distance_m)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatDuration(route.total_duration_s)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge value={route.status} />
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/trasy/${route.id}`}
                          className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          Szczegoly
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <ScreenState
            title="Brak tras"
            description="Po utworzeniu pierwszej trasy zobaczysz ja wlasnie tutaj."
          />
        )}
      </section>
    </AppShell>
  );
}

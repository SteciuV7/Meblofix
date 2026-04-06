import { AppShell } from "@/components/layout/AppShell";
import { ScreenState } from "@/components/layout/ScreenState";
import { StatusBadge } from "@/components/StatusBadge";
import { ROLE, ROUTE_STATUS } from "@/lib/constants";
import { apiFetch } from "@/lib/client-api";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { formatDate, getRouteDisplayName } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function DriverPanelPage() {
  const router = useRouter();
  const { profile, loading, error } = useCurrentProfile();
  const [routes, setRoutes] = useState([]);
  const [loadError, setLoadError] = useState(null);

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
        const visibleStatuses = Object.values(ROUTE_STATUS).filter(
          (status) => status !== ROUTE_STATUS.COMPLETED
        );
        const response = await apiFetch(`/api/trasy?statuses=${visibleStatuses.join(",")}`);

        if (!active) return;
        setRoutes(response.routes || []);
      } catch (err) {
        if (!active) return;
        setLoadError(err.message || "Nie udalo sie pobrac panelu kierowcy.");
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [profile, router]);

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
      title="Panel kierowcy"
      subtitle="Widok tras roboczych. Pokazujemy wszystkie trasy poza zakonczonymi."
    >
      {loadError ? (
        <ScreenState title="Blad panelu kierowcy" description={loadError} />
      ) : routes.length ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {routes.map((route) => (
            <div
              key={route.id}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-slate-500">Trasa</div>
                  <div className="mt-2 text-2xl font-bold text-slate-950">
                    {getRouteDisplayName(route)}
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-500">{route.numer}</div>
                  <div className="mt-2 text-sm text-slate-600">
                    Start: {formatDate(route.planowany_start_at, true)}
                  </div>
                </div>
                <StatusBadge value={route.status} />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/trasy/panel/${route.id}`}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {route.status === ROUTE_STATUS.PLANNED
                    ? "Rozpocznij trase"
                    : "Kontynuuj trase"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ScreenState
          title="Brak aktywnych tras"
          description="Gdy pojawi sie trasa w statusie innym niz completed, zobaczysz ja tutaj."
        />
      )}
    </AppShell>
  );
}

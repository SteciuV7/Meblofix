import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { ScreenState } from "@/components/layout/ScreenState";
import ComplaintPreviewModal from "@/components/reklamacje/ComplaintPreviewModal";
import {
  ACTIVE_REKLAMACJA_STATUSES,
  ROLE,
} from "@/lib/constants";
import { apiFetch } from "@/lib/client-api";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const RouteMap = dynamic(() => import("@/components/maps/RouteMap"), {
  ssr: false,
});

export default function ComplaintMapPage() {
  const router = useRouter();
  const { profile, loading, error } = useCurrentProfile();
  const [reklamacje, setReklamacje] = useState([]);
  const [firmy, setFirmy] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [firmaFilter, setFirmaFilter] = useState("");
  const [previewComplaint, setPreviewComplaint] = useState(null);
  const [savingComplaintId, setSavingComplaintId] = useState(null);

  useEffect(() => {
    if (error) {
      router.push("/login");
    }
  }, [error, router]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    let active = true;

    async function loadMapData() {
      try {
        setMapLoading(true);
        const response = await apiFetch("/api/mapa");

        if (!active) {
          return;
        }

        setReklamacje(response.reklamacje || []);
        setFirmy(response.firmy || []);
        setLoadError(null);
      } catch (loadMapError) {
        if (!active) {
          return;
        }

        setLoadError(loadMapError.message || "Nie udalo sie pobrac punktow mapy.");
      } finally {
        if (active) {
          setMapLoading(false);
        }
      }
    }

    loadMapData();

    return () => {
      active = false;
    };
  }, [profile]);

  const companyOptions = useMemo(
    () =>
      [...firmy].sort((left, right) =>
        (left.nazwa_firmy || "").localeCompare(right.nazwa_firmy || "", "pl")
      ),
    [firmy]
  );

  const filteredReklamacje = useMemo(() => {
    if (profile?.role !== ROLE.ADMIN) {
      return reklamacje;
    }

    return reklamacje.filter((reklamacja) => {
      if (statusFilter && reklamacja.status !== statusFilter) {
        return false;
      }

      if (firmaFilter && reklamacja.firma_id !== firmaFilter) {
        return false;
      }

      return true;
    });
  }, [firmaFilter, profile?.role, reklamacje, statusFilter]);

  async function handleTogglePickedUp(stop) {
    if (profile?.role !== ROLE.ADMIN) {
      return;
    }

    const complaint = stop?.reklamacje || stop;
    if (!complaint?.id) {
      return;
    }

    const nextPickedUp = !Boolean(complaint.element_odebrany);

    try {
      setSavingComplaintId(complaint.id);

      const response = await apiFetch(`/api/reklamacje/${complaint.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "set-element-odebrany",
          payload: {
            element_odebrany: nextPickedUp,
          },
        }),
      });

      const updatedComplaint = response.reklamacja;

      setReklamacje((current) =>
        current.map((item) =>
          item.id === updatedComplaint.id ? { ...item, ...updatedComplaint } : item
        )
      );
      setPreviewComplaint((current) =>
        current?.id === updatedComplaint.id
          ? { ...current, ...updatedComplaint }
          : current
      );
    } catch (toggleError) {
      alert(toggleError.message || "Nie udalo sie zmienic stanu elementu.");
    } finally {
      setSavingComplaintId(null);
    }
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
        title="Mapa"
        subtitle={
          profile.role === ROLE.ADMIN
            ? "Mapa aktywnych reklamacji wszystkich firm z filtrowaniem po statusie i firmie."
            : "Mapa Twoich aktywnych reklamacji z szybkim podgladem szczegolow."
        }
        pageHeaderClassName="mb-4 gap-2 lg:items-center"
        subtitleClassName="mt-1 text-sm"
        actionsClassName="items-center gap-2"
        actions={
          profile.role === ROLE.ADMIN ? (
            <>
              <select
                aria-label="Filtr statusu mapy"
                className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-500"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">Wszystkie aktywne</option>
                {ACTIVE_REKLAMACJA_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtr firmy na mapie"
                className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-500"
                value={firmaFilter}
                onChange={(event) => setFirmaFilter(event.target.value)}
              >
                <option value="">Wszystkie firmy</option>
                {companyOptions.map((firma) => (
                  <option key={firma.firma_id} value={firma.firma_id}>
                    {firma.nazwa_firmy}
                  </option>
                ))}
              </select>

              <div className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-600 shadow-sm">
                Punkty:{" "}
                <span className="ml-1 font-semibold text-slate-950">
                  {filteredReklamacje.length}
                </span>
              </div>
            </>
          ) : (
            <div className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-600 shadow-sm">
              Punkty:{" "}
              <span className="ml-1 font-semibold text-slate-950">
                {filteredReklamacje.length}
              </span>
            </div>
          )
        }
        fullWidth
      >
        <div className="flex h-[calc(100svh-14.5rem)] flex-col overflow-hidden lg:h-[calc(100svh-11.5rem)]">
          {loadError ? (
            <div className="min-h-0 flex-1 overflow-hidden rounded-[2rem]">
              <ScreenState
                title="Nie udalo sie wczytac mapy"
                description={loadError}
              />
            </div>
          ) : mapLoading ? (
            <div className="min-h-0 flex-1 overflow-hidden rounded-[2rem]">
              <ScreenState
                title="Ladowanie mapy"
                description="Pobieram punkty reklamacji i przygotowuje widok mapy."
              />
            </div>
          ) : filteredReklamacje.length ? (
            <section className="min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
              <RouteMap
                className="h-full border-0 shadow-none"
                stops={filteredReklamacje}
                overlapMode="coordinates-first"
                popupVariant="complaint-map"
                height="100%"
                showPickedUp={profile.role === ROLE.ADMIN}
                onShowStopDetails={(stop) =>
                  setPreviewComplaint(stop.reklamacje || stop)
                }
                renderStopActions={
                  profile.role === ROLE.ADMIN
                    ? (stop) => {
                        const complaint = stop?.reklamacje || stop;
                        const isPickedUp = Boolean(complaint?.element_odebrany);
                        const isSaving = savingComplaintId === complaint?.id;

                        return (
                          <button
                            type="button"
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                              isPickedUp
                                ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                                : "bg-slate-950 text-white hover:bg-slate-800"
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                            onClick={() => handleTogglePickedUp(stop)}
                            disabled={isSaving}
                          >
                            {isSaving
                              ? "Zapisywanie..."
                              : isPickedUp
                                ? "Cofnij oznaczenie"
                                : "Oznacz jako odebrany"}
                          </button>
                        );
                      }
                    : undefined
                }
              />
            </section>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden rounded-[2rem]">
              <ScreenState
                title={
                  profile.role === ROLE.ADMIN
                    ? "Brak aktywnych punktow na mapie"
                    : "Brak Twoich aktywnych punktow na mapie"
                }
                description={
                  profile.role === ROLE.ADMIN
                    ? "Zmien filtry albo poczekaj na kolejne reklamacje z przypisana geolokalizacja."
                    : "Nowe reklamacje z poprawna geolokalizacja pojawia sie tutaj automatycznie."
                }
              />
            </div>
          )}
        </div>
      </AppShell>

      <ComplaintPreviewModal
        complaint={previewComplaint}
        showPickedUp={profile.role === ROLE.ADMIN}
        onClose={() => setPreviewComplaint(null)}
      />
    </>
  );
}

import { AppShell } from "@/components/layout/AppShell";
import { ScreenState } from "@/components/layout/ScreenState";
import { StatusBadge } from "@/components/StatusBadge";
import { uploadFiles } from "@/components/reklamacje/FileUploadField";
import { ROLE } from "@/lib/constants";
import { apiFetch } from "@/lib/client-api";
import { getPublicStorageUrl } from "@/lib/storage";
import { useCurrentProfile } from "@/lib/use-current-profile";
import {
  formatDate,
  formatDistance,
  formatDuration,
  getRouteDisplayName,
  safeArray,
} from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

function buildEditState(detail) {
  return {
    numer_faktury: detail?.reklamacja?.numer_faktury || "",
    kod_pocztowy: detail?.reklamacja?.kod_pocztowy || "",
    miejscowosc: detail?.reklamacja?.miejscowosc || "",
    adres: detail?.reklamacja?.adres || "",
    opis: detail?.reklamacja?.opis || "",
    informacje_od_zglaszajacego:
      detail?.reklamacja?.informacje_od_zglaszajacego || "",
    informacje: detail?.reklamacja?.informacje || "",
    opis_przebiegu: detail?.reklamacja?.opis_przebiegu || "",
    realizacja_do: detail?.reklamacja?.realizacja_do
      ? new Date(detail.reklamacja.realizacja_do).toISOString().slice(0, 16)
      : "",
  };
}

function DetailCard({ title, children }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
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
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [acknowledge, setAcknowledge] = useState(false);
  const [closePdf, setClosePdf] = useState(null);
  const [closeImages, setCloseImages] = useState([]);

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
      } catch (err) {
        if (!active) return;
        setLoadError(err.message || "Nie udało się pobrać reklamacji.");
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [profile, id]);

  const images = useMemo(
    () => safeArray(detail?.reklamacja?.zalacznik_zdjecia),
    [detail?.reklamacja?.zalacznik_zdjecia]
  );

  async function refresh() {
    const response = await apiFetch(`/api/reklamacje/${id}`);
    setDetail(response);
    setEditState(buildEditState(response));
  }

  async function update(action, payload = {}) {
    try {
      setSaving(true);
      await apiFetch(`/api/reklamacje/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, payload }),
      });
      await refresh();
    } catch (err) {
      alert(err.message || "Nie udało się wykonać operacji.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    await update("update", {
      ...editState,
      realizacja_do: editState.realizacja_do
        ? new Date(editState.realizacja_do).toISOString()
        : null,
    });
  }

  async function handleManualClose() {
    try {
      setSaving(true);
      const [pdfPaths, imagePaths] = await Promise.all([
        closePdf ? uploadFiles([closePdf], "pdfs") : Promise.resolve([]),
        uploadFiles(closeImages, "images"),
      ]);

      await apiFetch(`/api/reklamacje/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "close",
          payload: {
            opis_przebiegu: editState.opis_przebiegu,
            zalacznik_pdf_zakonczenie:
              pdfPaths[0] || detail.reklamacja.zalacznik_pdf_zakonczenie,
            zalacznik_zakonczenie:
              imagePaths.length > 0
                ? imagePaths
                : detail.reklamacja.zalacznik_zakonczenie || [],
          },
        }),
      });

      setClosePdf(null);
      setCloseImages([]);
      await refresh();
    } catch (err) {
      alert(err.message || "Nie udało się zakończyć reklamacji.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAcknowledge() {
    try {
      setSaving(true);
      await apiFetch(`/api/reklamacje/${id}/acknowledge`, {
        method: "POST",
      });
      setAcknowledge(false);
      await refresh();
    } catch (err) {
      alert(err.message || "Nie udało się potwierdzić odczytu.");
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

  if (!profile) {
    return null;
  }

  return (
    <AppShell
      profile={profile}
      title={`Reklamacja ${detail?.reklamacja?.nr_reklamacji || ""}`}
      subtitle="Pełny szczegół zgłoszenia z historią zmian, informacją o trasie i akcjami administracyjnymi."
      actions={
        <Link
          href="/reklamacje"
          className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
        >
          Wróć do listy
        </Link>
      }
      fullWidth
    >
      {loadError ? (
        <ScreenState title="Nie udało się wczytać reklamacji" description={loadError} />
      ) : !detail ? (
        <ScreenState title="Ładowanie szczegółów" description="Pobieram reklamację i historię logów." />
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr),420px]">
          <section className="space-y-8">
            <DetailCard title="Dane reklamacji">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
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
                        Trasa {getRouteDisplayName(detail.routeStop.trasy)}
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <div>Dodano: {formatDate(detail.reklamacja.data_zgloszenia, true)}</div>
                  <div className="mt-1">
                    Termin: {formatDate(detail.reklamacja.realizacja_do, true)}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Numer faktury
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                    value={editState.numer_faktury}
                    onChange={(event) =>
                      setEditState((current) => ({
                        ...current,
                        numer_faktury: event.target.value,
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
                    onChange={(event) =>
                      setEditState((current) => ({
                        ...current,
                        kod_pocztowy: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Miejscowość
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                    value={editState.miejscowosc}
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
                    onChange={(event) =>
                      setEditState((current) => ({
                        ...current,
                        opis: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700 md:col-span-2">
                  Informacje od zgłaszającego
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3"
                    value={editState.informacje_od_zglaszajacego}
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
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Zapisywanie..." : "Zapisz zmiany"}
                </button>
                {profile.role === ROLE.ADMIN ? (
                  <>
                    <button
                      type="button"
                      className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
                      onClick={() => update("accept")}
                      disabled={saving}
                    >
                      Przyjmij
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-400"
                      onClick={() => update("request-info")}
                      disabled={saving}
                    >
                      Oczekuje na informacje
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white hover:bg-fuchsia-500"
                      onClick={() => update("waiting-delivery")}
                      disabled={saving}
                    >
                      Oczekuje na dostawę
                    </button>
                  </>
                ) : null}
              </div>
            </DetailCard>

            <DetailCard title="Załączniki">
              <div className="flex flex-wrap gap-3">
                {detail.reklamacja.zalacznik_pdf ? (
                  <a
                    href={getPublicStorageUrl(detail.reklamacja.zalacznik_pdf)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Otwórz PDF
                  </a>
                ) : null}
                {images.map((image) => (
                  <a
                    key={image}
                    href={getPublicStorageUrl(image)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Zdjęcie
                  </a>
                ))}
                {!detail.reklamacja.zalacznik_pdf && !images.length ? (
                  <div className="text-slate-400">Brak załączników do zgłoszenia.</div>
                ) : null}
              </div>
            </DetailCard>

            <DetailCard title="Historia działań">
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
                <p className="text-slate-500">Brak logów dla tej reklamacji.</p>
              )}
            </DetailCard>
          </section>

          <aside className="space-y-8">
            <DetailCard title="Powiązana trasa">
              {detail.routeStop?.trasy ? (
                <div className="space-y-3 text-sm text-slate-700">
                  <div>Nazwa: {detail.routeStop.trasy.nazwa || "Brak nazwy wlasnej"}</div>
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
                  <div>Kolejność punktu: {detail.routeStop.kolejnosc}</div>
                  <div>ETA od: {formatDate(detail.routeStop.eta_from, true)}</div>
                  <div>ETA do: {formatDate(detail.routeStop.eta_to, true)}</div>
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

            {profile.role !== ROLE.ADMIN &&
            detail.reklamacja.nieprzeczytane_dla_uzytkownika ? (
              <DetailCard title="Potwierdzenie zapoznania">
                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={acknowledge}
                    onChange={(event) => setAcknowledge(event.target.checked)}
                  />
                  <span>
                    Potwierdzam zapoznanie się z reklamacją i ostatnimi zmianami.
                  </span>
                </label>
                <button
                  type="button"
                  className="mt-5 rounded-full bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleAcknowledge}
                  disabled={!acknowledge || saving}
                >
                  Potwierdź odczyt
                </button>
              </DetailCard>
            ) : null}

            {profile.role === ROLE.ADMIN ? (
              <DetailCard title="Ręczne zakończenie">
                <label className="block text-sm text-slate-700">
                  Opis przebiegu
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3"
                    value={editState.opis_przebiegu}
                    onChange={(event) =>
                      setEditState((current) => ({
                        ...current,
                        opis_przebiegu: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="mt-4 block text-sm text-slate-700">
                  PDF po zakończeniu
                  <input
                    type="file"
                    accept="application/pdf"
                    className="mt-2 w-full rounded-2xl border border-dashed border-slate-200 px-4 py-3"
                    onChange={(event) => setClosePdf(event.target.files?.[0] || null)}
                  />
                </label>
                <label className="mt-4 block text-sm text-slate-700">
                  Zdjęcia po zakończeniu
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="mt-2 w-full rounded-2xl border border-dashed border-slate-200 px-4 py-3"
                    onChange={(event) =>
                      setCloseImages(Array.from(event.target.files || []))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="mt-5 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
                  onClick={handleManualClose}
                  disabled={saving}
                >
                  Oznacz jako zakończone
                </button>
              </DetailCard>
            ) : null}
          </aside>
        </div>
      )}
    </AppShell>
  );
}

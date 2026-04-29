import { AppShell } from "@/components/layout/AppShell";
import { ScreenState } from "@/components/layout/ScreenState";
import { apiFetch } from "@/lib/client-api";
import { ROLE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { cn, formatDate } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

function toDateInputValue(date) {
  const parsed = new Date(date);
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMonthStartValue() {
  const today = new Date();
  return toDateInputValue(
    new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0)
  );
}

function getTodayValue() {
  return toDateInputValue(new Date());
}

function getDocumentLabel(complaint) {
  return complaint.numer_faktury || complaint.nr_reklamacji || "-";
}

function parseDownloadFilename(response) {
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || "rozliczenie.pdf";
}

function FilterField({ label, children, className = "" }) {
  return (
    <label className={cn("block", className)}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>
      {children}
    </label>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[12px] font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold leading-none text-slate-950">
        {value}
      </div>
    </div>
  );
}

export default function RozliczeniaPage() {
  const router = useRouter();
  const { profile, loading, error } = useCurrentProfile();
  const [companies, setCompanies] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [firmaId, setFirmaId] = useState("");
  const [dateFrom, setDateFrom] = useState(getCurrentMonthStartValue());
  const [dateTo, setDateTo] = useState(getTodayValue());
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [downloadError, setDownloadError] = useState(null);

  useEffect(() => {
    if (error) {
      router.push("/login");
    }
  }, [error, router]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    if (profile.role !== ROLE.ADMIN) {
      router.replace("/dashboard");
      return;
    }

    let active = true;

    async function load() {
      try {
        setLoadingList(true);

        const params = new URLSearchParams();

        if (firmaId) {
          params.set("firmaId", firmaId);
        }

        if (dateFrom && dateTo) {
          params.set("dateFrom", dateFrom);
          params.set("dateTo", dateTo);
        }

        const response = await apiFetch(
          `/api/rozliczenia${params.toString() ? `?${params}` : ""}`
        );

        if (!active) {
          return;
        }

        setCompanies(response.companies || []);
        setComplaints(response.complaints || []);
        setSelectedIds((response.complaints || []).map((item) => item.id));
        setLoadError(null);
      } catch (err) {
        if (!active) {
          return;
        }

        setLoadError(err.message || "Nie udalo sie pobrac danych do rozliczenia.");
        setComplaints([]);
        setSelectedIds([]);
      } finally {
        if (active) {
          setLoadingList(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [dateFrom, dateTo, firmaId, profile, router]);

  const selectedCompany = useMemo(
    () => companies.find((item) => item.firma_id === firmaId) || null,
    [companies, firmaId]
  );
  const allSelected =
    complaints.length > 0 && selectedIds.length === complaints.length;
  const canGenerate =
    Boolean(firmaId) &&
    Boolean(dateFrom) &&
    Boolean(dateTo) &&
    selectedIds.length > 0 &&
    !loadingList;

  function toggleComplaint(complaintId) {
    setSelectedIds((current) =>
      current.includes(complaintId)
        ? current.filter((item) => item !== complaintId)
        : [...current, complaintId]
    );
  }

  function toggleAllComplaints() {
    setSelectedIds(allSelected ? [] : complaints.map((item) => item.id));
  }

  async function handleDownloadPdf() {
    try {
      setGenerating(true);
      setDownloadError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/rozliczenia/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          firmaId,
          dateFrom,
          dateTo,
          reklamacjeIds: selectedIds,
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json")
          ? await response.json()
          : await response.text();
        throw new Error(
          typeof payload === "string"
            ? payload
            : payload?.error || "Nie udalo sie wygenerowac PDF."
        );
      }

      const blob = await response.blob();
      const fileName = parseDownloadFilename(response);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err.message || "Nie udalo sie pobrac rozliczenia.");
    } finally {
      setGenerating(false);
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
    <AppShell
      profile={profile}
      title="Rozliczenia okresowe"
      subtitle="Modul administracyjny do filtrowania zakonczonych reklamacji po firmie i dacie zakonczenia oraz pobierania jednorazowego PDF bez zapisu w bazie."
      fullWidth
      actions={
        <Link
          href="/dashboard"
          className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
        >
          Wroc do dashboardu
        </Link>
      }
    >
      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Firma"
          value={selectedCompany?.nazwa_firmy || "Nie wybrano"}
        />
        <StatCard label="Pozycje w okresie" value={complaints.length} />
        <StatCard label="Zaznaczone" value={selectedIds.length} />
        <StatCard
          label="Zakres"
          value={dateFrom && dateTo ? `${dateFrom} -> ${dateTo}` : "-"}
        />
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.2fr),180px,180px,auto]">
          <FilterField label="Firma">
            <select
              value={firmaId}
              onChange={(event) => setFirmaId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
            >
              <option value="">Wybierz firme</option>
              {companies.map((company) => (
                <option key={company.firma_id} value={company.firma_id}>
                  {company.nazwa_firmy}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Data od">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
            />
          </FilterField>

          <FilterField label="Data do">
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
            />
          </FilterField>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!canGenerate || generating}
              className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? "Generowanie PDF..." : "Pobierz PDF"}
            </button>
          </div>
        </div>

        <div className="mt-3 text-sm text-slate-500">
          Lista jest filtrowana po dacie zakonczenia reklamacji. PDF nie jest
          zapisywany w bazie.
        </div>

        {downloadError ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {downloadError}
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Zakonczone reklamacje
            </h2>
            <div className="mt-1 text-sm text-slate-500">
              Zaznacz pozycje, ktore maja trafic do rozliczenia PDF.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleAllComplaints}
              disabled={!complaints.length}
              className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {allSelected ? "Odznacz wszystko" : "Zaznacz wszystko"}
            </button>
          </div>
        </div>

        <div className="p-5">
          {loadingList ? (
            <ScreenState
              title="Ladowanie reklamacji"
              description="Pobieram zakonczone reklamacje dla wybranego zakresu."
            />
          ) : loadError ? (
            <ScreenState
              title="Blad ladowania"
              description={loadError}
            />
          ) : !firmaId ? (
            <ScreenState
              title="Wybierz firme"
              description="Po wskazaniu firmy i zakresu dat pokazemy zakonczone reklamacje do rozliczenia."
            />
          ) : !complaints.length ? (
            <ScreenState
              title="Brak reklamacji"
              description="Nie ma zakonczonych reklamacji dla wybranej firmy i okresu."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="w-14 px-3 py-2">
                      <span className="sr-only">Zaznacz</span>
                    </th>
                    <th className="px-3 py-2">Data zakonczenia</th>
                    <th className="px-3 py-2">Numer faktury / reklamacji</th>
                    <th className="px-3 py-2">Nazwa mebla</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((complaint) => {
                    const checked = selectedIds.includes(complaint.id);

                    return (
                      <tr
                        key={complaint.id}
                        className={cn(
                          "border-t border-slate-200",
                          checked ? "bg-sky-50/70" : ""
                        )}
                      >
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleComplaint(complaint.id)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950"
                          />
                        </td>
                        <td className="px-3 py-3 align-top text-slate-900">
                          <div className="font-semibold">
                            {formatDate(complaint.data_zakonczenia, true)}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top font-medium text-slate-900">
                          {getDocumentLabel(complaint)}
                        </td>
                        <td className="px-3 py-3 align-top text-slate-700">
                          {complaint.nazwa_mebla || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

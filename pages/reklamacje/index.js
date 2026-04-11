import { AppShell } from "@/components/layout/AppShell";
import { ScreenState } from "@/components/layout/ScreenState";
import ComplaintAcceptModal from "@/components/reklamacje/ComplaintAcceptModal";
import ComplaintCloseModal from "@/components/reklamacje/ComplaintCloseModal";
import ComplaintStatusModal from "@/components/reklamacje/ComplaintStatusModal";
import { ReklamacjeTable } from "@/components/reklamacje/ReklamacjeTable";
import { apiFetch } from "@/lib/client-api";
import {
  ACCEPTABLE_REKLAMACJA_STATUSES,
  REKLAMACJA_STATUS,
  REKLAMACJA_STATUS_OPTIONS,
  ROLE,
} from "@/lib/constants";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { calculateRemainingDays, cn, normalizeText } from "@/lib/utils";
import { CirclePlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
      <div className="text-[12px] font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold leading-none text-slate-950">
        {value}
      </div>
    </div>
  );
}

function FilterField({ label, className = "", children }) {
  return (
    <label className={cn("block", className)}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>
      {children}
    </label>
  );
}

function companyFilterValue(reklamacja) {
  return reklamacja?.firma_id || reklamacja?.nazwa_firmy || "";
}

export default function ReklamacjeIndexPage() {
  const router = useRouter();
  const { profile, loading, error } = useCurrentProfile();
  const [reklamacje, setReklamacje] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [firma, setFirma] = useState("");
  const [terminOd, setTerminOd] = useState("");
  const [terminDo, setTerminDo] = useState("");
  const [loadError, setLoadError] = useState(null);
  const [acceptModalComplaint, setAcceptModalComplaint] = useState(null);
  const [acceptingComplaintId, setAcceptingComplaintId] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusModalComplaint, setStatusModalComplaint] = useState(null);
  const [closeModalComplaint, setCloseModalComplaint] = useState(null);

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

    async function load() {
      try {
        const response = await apiFetch("/api/reklamacje");

        if (!active) {
          return;
        }

        setReklamacje(response.reklamacje || []);
        setLoadError(null);
      } catch (err) {
        if (!active) {
          return;
        }

        setLoadError(err.message || "Nie udalo sie pobrac reklamacji.");
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [profile]);

  async function refreshReklamacje() {
    const response = await apiFetch("/api/reklamacje");
    setReklamacje(response.reklamacje || []);
    setLoadError(null);
  }

  function canAcceptComplaint(reklamacja) {
    return (
      profile?.role === ROLE.ADMIN &&
      ACCEPTABLE_REKLAMACJA_STATUSES.includes(reklamacja.status) &&
      !reklamacja.activeRouteStop
    );
  }

  async function handleAcceptComplaint(reklamacja) {
    setAcceptModalComplaint(reklamacja);
  }

  async function handleAcceptSubmit(payload) {
    if (!acceptModalComplaint) {
      return;
    }

    setAcceptingComplaintId(acceptModalComplaint.id);

    try {
      await apiFetch(`/api/reklamacje/${acceptModalComplaint.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "accept",
          payload,
        }),
      });
      await refreshReklamacje();
      setAcceptModalComplaint(null);
    } catch (error) {
      throw error;
    } finally {
      setAcceptingComplaintId(null);
    }
  }

  async function handleStatusSubmit(nextStatus) {
    if (!statusModalComplaint) {
      return;
    }

    if (nextStatus === REKLAMACJA_STATUS.DONE) {
      setCloseModalComplaint(statusModalComplaint);
      setStatusModalComplaint(null);
      return;
    }

    setSavingStatus(true);

    try {
      await apiFetch(`/api/reklamacje/${statusModalComplaint.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "manual-status-change",
          payload: { status: nextStatus },
        }),
      });
      await refreshReklamacje();
      setStatusModalComplaint(null);
    } catch (error) {
      throw error;
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleCloseSubmit(payload) {
    if (!closeModalComplaint) {
      return;
    }

    setSavingStatus(true);

    try {
      await apiFetch(`/api/reklamacje/${closeModalComplaint.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "manual-status-change",
          payload: {
            status: REKLAMACJA_STATUS.DONE,
            closePayload: payload,
          },
        }),
      });
      await refreshReklamacje();
      setCloseModalComplaint(null);
    } catch (error) {
      throw error;
    } finally {
      setSavingStatus(false);
    }
  }

  const firmyOptions = useMemo(() => {
    const unique = new Map();

    reklamacje.forEach((reklamacja) => {
      const key = companyFilterValue(reklamacja);
      if (!key || unique.has(key)) {
        return;
      }

      unique.set(key, {
        value: key,
        label: reklamacja.nazwa_firmy || "Bez nazwy firmy",
      });
    });

    return [...unique.values()].sort((left, right) =>
      left.label.localeCompare(right.label, "pl")
    );
  }, [reklamacje]);

  const filtered = useMemo(() => {
    const needle = normalizeText(search).toLowerCase();
    const fromDate = terminOd ? new Date(`${terminOd}T00:00:00`) : null;
    const toDate = terminDo ? new Date(`${terminDo}T23:59:59.999`) : null;

    return reklamacje.filter((reklamacja) => {
      const matchesStatus = status ? reklamacja.status === status : true;
      if (!matchesStatus) {
        return false;
      }

      const matchesFirma = firma ? companyFilterValue(reklamacja) === firma : true;
      if (!matchesFirma) {
        return false;
      }

      if (fromDate || toDate) {
        if (!reklamacja.realizacja_do) {
          return false;
        }

        const termin = new Date(reklamacja.realizacja_do);
        if (Number.isNaN(termin.getTime())) {
          return false;
        }

        if (fromDate && termin < fromDate) {
          return false;
        }

        if (toDate && termin > toDate) {
          return false;
        }
      }

      if (!needle) {
        return true;
      }

      return normalizeText(
        [
          reklamacja.nazwa_firmy,
          reklamacja.nazwa_mebla,
          reklamacja.imie_klienta,
          reklamacja.nazwisko_klienta,
          reklamacja.telefon_klienta,
          reklamacja.nr_reklamacji,
          reklamacja.numer_faktury,
          reklamacja.miejscowosc,
          reklamacja.adres,
          reklamacja.kod_pocztowy,
          reklamacja.opis,
        ]
          .filter(Boolean)
          .join(" ")
      )
        .toLowerCase()
        .includes(needle);
    });
  }, [firma, reklamacje, search, status, terminDo, terminOd]);

  const stats = useMemo(() => {
    const urgent = reklamacje.filter((item) => {
      const remaining = calculateRemainingDays(item.realizacja_do);
      return remaining != null && remaining <= 3;
    }).length;

    const planned = reklamacje.filter(
      (item) => item.status === REKLAMACJA_STATUS.ROUTE_PLANNED
    ).length;

    const unread = reklamacje.filter(
      (item) => item.nieprzeczytane_dla_uzytkownika
    ).length;

    return { urgent, planned, unread };
  }, [reklamacje]);

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
        title="Reklamacje"
        pageHeaderClassName="mb-4 gap-2"
        titleClassName="text-[1.65rem]"
        subtitleClassName="mt-1 max-w-4xl text-[12px]"
        actionsClassName="gap-2"
        subtitle="Aktualna lista zgloszen z pelnym widokiem szczegolu reklamacji i historia zmian."
        actions={
          <Link
            href="/reklamacje/nowa"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-emerald-500"
          >
            <CirclePlus className="h-4 w-4" />
            Dodaj reklamacje
          </Link>
        }
        fullWidth
      >
        <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Aktywne" value={reklamacje.length} />
          <StatCard label="Pilne do 3 dni" value={stats.urgent} />
          <StatCard label="Zaplanowane na trase" value={stats.planned} />
          <StatCard label="Nieprzeczytane" value={stats.unread} />
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
          <FilterField label="Szukaj">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Firma, mebel, klient, telefon, numer reklamacji, miasto, adres..."
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none transition focus:border-slate-400"
            />
          </FilterField>

          <div className="mt-2 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              <FilterField label="Status" className="w-[170px] shrink-0">
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none transition focus:border-slate-400"
                >
                  <option value="">Wszystkie statusy</option>
                  {REKLAMACJA_STATUS_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Firma" className="w-[170px] shrink-0">
                <select
                  value={firma}
                  onChange={(event) => setFirma(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none transition focus:border-slate-400"
                >
                  <option value="">Wszystkie firmy</option>
                  {firmyOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Termin" className="w-[250px] shrink-0">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={terminOd}
                    max={terminDo || undefined}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setTerminOd(nextValue);
                      if (terminDo && nextValue && nextValue > terminDo) {
                        setTerminDo(nextValue);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none transition focus:border-slate-400"
                  />
                  <input
                    type="date"
                    value={terminDo}
                    min={terminOd || undefined}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setTerminDo(nextValue);
                      if (terminOd && nextValue && nextValue < terminOd) {
                        setTerminOd(nextValue);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none transition focus:border-slate-400"
                  />
                </div>
              </FilterField>
            </div>
          </div>
        </section>

        <section className="mt-4">
          {loadError ? (
            <ScreenState title="Blad ladowania" description={loadError} />
          ) : filtered.length ? (
            <ReklamacjeTable
              reklamacje={filtered}
              showFirma={profile.role === ROLE.ADMIN}
              showRemainingBadge={profile.role === ROLE.ADMIN}
              onStatusClick={
                profile.role === ROLE.ADMIN
                  ? (reklamacja) => setStatusModalComplaint(reklamacja)
                  : undefined
              }
              canRowAction={canAcceptComplaint}
              onRowAction={handleAcceptComplaint}
              rowActionBusyLabel="Przyjmowanie..."
              rowActionLabel="Przyjmij"
              rowActionLoadingId={acceptingComplaintId}
            />
          ) : (
            <ScreenState
              title="Brak reklamacji"
              description="Po dodaniu zgloszenia pojawi sie tutaj pelna karta ze szczegolami i historia zmian."
            />
          )}
        </section>
      </AppShell>

      <ComplaintStatusModal
        isOpen={Boolean(statusModalComplaint)}
        reklamacja={statusModalComplaint}
        loading={savingStatus}
        onClose={() => {
          if (!savingStatus) {
            setStatusModalComplaint(null);
          }
        }}
        onSubmit={handleStatusSubmit}
      />

      <ComplaintAcceptModal
        isOpen={Boolean(acceptModalComplaint)}
        reklamacja={acceptModalComplaint}
        loading={Boolean(acceptModalComplaint && acceptingComplaintId)}
        onClose={() => {
          if (!acceptingComplaintId) {
            setAcceptModalComplaint(null);
          }
        }}
        onSubmit={handleAcceptSubmit}
      />

      <ComplaintCloseModal
        isOpen={Boolean(closeModalComplaint)}
        mode="close"
        initialValue={{
          opis_przebiegu: closeModalComplaint?.opis_przebiegu || "",
          zalacznik_pdf_zakonczenie:
            closeModalComplaint?.zalacznik_pdf_zakonczenie || null,
          zalacznik_zakonczenie: Array.isArray(
            closeModalComplaint?.zalacznik_zakonczenie
          )
            ? closeModalComplaint.zalacznik_zakonczenie
            : [],
        }}
        onClose={() => {
          if (!savingStatus) {
            setCloseModalComplaint(null);
          }
        }}
        onSubmit={handleCloseSubmit}
      />
    </>
  );
}

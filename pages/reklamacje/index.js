import { AppShell } from "@/components/layout/AppShell";
import { ScreenState } from "@/components/layout/ScreenState";
import { ReklamacjeTable } from "@/components/reklamacje/ReklamacjeTable";
import { REKLAMACJA_STATUS, ROLE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { calculateRemainingDays, normalizeText } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

function StatCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

export default function ReklamacjeIndexPage() {
  const router = useRouter();
  const { profile, loading, error } = useCurrentProfile();
  const [reklamacje, setReklamacje] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (error) {
      router.push("/login");
    }
  }, [error, router]);

  useEffect(() => {
    if (!profile) return;

    let active = true;

    async function load() {
      try {
        let query = supabase
          .from("reklamacje")
          .select("*")
          .neq("status", REKLAMACJA_STATUS.ARCHIVE)
          .order("data_zgloszenia", { ascending: false });

        if (profile.role !== ROLE.ADMIN) {
          query = query.eq("firma_id", profile.firma_id);
        }

        const { data, error: queryError } = await query;
        if (queryError) throw queryError;

        if (!active) return;
        setReklamacje(data || []);
      } catch (err) {
        if (!active) return;
        setLoadError(err.message || "Nie udało się pobrać reklamacji.");
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [profile]);

  const filtered = useMemo(() => {
    const needle = normalizeText(search).toLowerCase();

    return reklamacje.filter((reklamacja) => {
      const matchesStatus = status ? reklamacja.status === status : true;
      if (!matchesStatus) return false;
      if (!needle) return true;

      return normalizeText(
        [
          reklamacja.nazwa_firmy,
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
  }, [reklamacje, search, status]);

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
      title="Reklamacje"
      subtitle="Aktualna lista zgłoszeń z nowym wejściem do pełnego szczegółu reklamacji oraz historią zmian."
      actions={
        <Link
          href="/reklamacje/nowa"
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Dodaj reklamację
        </Link>
      }
      fullWidth
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Aktywne" value={reklamacje.length} />
        <StatCard label="Pilne do 3 dni" value={stats.urgent} />
        <StatCard label="Zaplanowane na trasę" value={stats.planned} />
        <StatCard label="Nieprzeczytane" value={stats.unread} />
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr,260px]">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Szukaj po firmie, fakturze, mieście, adresie albo opisie"
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
          >
            <option value="">Wszystkie statusy</option>
            {Object.values(REKLAMACJA_STATUS).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="mt-8">
        {loadError ? (
          <ScreenState title="Błąd ładowania" description={loadError} />
        ) : filtered.length ? (
          <ReklamacjeTable
            reklamacje={filtered}
            showFirma={profile.role === ROLE.ADMIN}
          />
        ) : (
          <ScreenState
            title="Brak reklamacji"
            description="Po dodaniu zgłoszenia pojawi się tutaj pełna karta ze szczegółami i historią zmian."
          />
        )}
      </section>
    </AppShell>
  );
}

import { AppShell } from "@/components/layout/AppShell";
import { ScreenState } from "@/components/layout/ScreenState";
import { ReklamacjeTable } from "@/components/reklamacje/ReklamacjeTable";
import { REKLAMACJA_STATUS, ROLE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { normalizeText } from "@/lib/utils";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

export default function ArchiwumPage() {
  const router = useRouter();
  const { profile, loading, error } = useCurrentProfile();
  const [reklamacje, setReklamacje] = useState([]);
  const [search, setSearch] = useState("");
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
          .eq("status", REKLAMACJA_STATUS.ARCHIVE)
          .order("data_zakonczenia", { ascending: false });

        if (profile.role !== ROLE.ADMIN) {
          query = query.eq("firma_id", profile.firma_id);
        }

        const { data, error: queryError } = await query;
        if (queryError) throw queryError;

        if (!active) return;
        setReklamacje(data || []);
      } catch (err) {
        if (!active) return;
        setLoadError(err.message || "Nie uda\u0142o si\u0119 pobra\u0107 archiwum.");
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [profile]);

  const filtered = useMemo(() => {
    const needle = normalizeText(search).toLowerCase();
    if (!needle) return reklamacje;

    return reklamacje.filter((reklamacja) =>
      normalizeText(
        [
          reklamacja.nazwa_firmy,
          reklamacja.imie_klienta,
          reklamacja.nazwisko_klienta,
          reklamacja.telefon_klienta,
          reklamacja.nr_reklamacji,
          reklamacja.numer_faktury,
          reklamacja.miejscowosc,
          reklamacja.adres,
          reklamacja.opis,
        ]
          .filter(Boolean)
          .join(" ")
      )
        .toLowerCase()
        .includes(needle)
    );
  }, [reklamacje, search]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        {"\u0141adowanie..."}
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <AppShell
      profile={profile}
      title="Archiwum reklamacji"
      subtitle="Zamkni\u0119te sprawy s\u0105 nadal dost\u0119pne pod pe\u0142nym adresem szczeg\u00f3\u0142u reklamacji."
      fullWidth
    >
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Szukaj po firmie, numerze reklamacji, mie\u015bcie lub opisie"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
        />
      </section>

      <section className="mt-8">
        {loadError ? (
          <ScreenState
            title="B\u0142\u0105d \u0142adowania archiwum"
            description={loadError}
          />
        ) : filtered.length ? (
          <ReklamacjeTable
            reklamacje={filtered}
            showFirma={profile.role === ROLE.ADMIN}
            showRoute={false}
          />
        ) : (
          <ScreenState
            title="Archiwum jest puste"
            description="Nie ma jeszcze zarchiwizowanych reklamacji dla tego konta."
          />
        )}
      </section>
    </AppShell>
  );
}

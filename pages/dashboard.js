import { AppShell } from "@/components/layout/AppShell";
import { ScreenState } from "@/components/layout/ScreenState";
import { ROLE } from "@/lib/constants";
import { useCurrentProfile } from "@/lib/use-current-profile";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";

const baseModules = [
  {
    href: "/reklamacje",
    title: "Reklamacje",
    description: "Bieżące zgłoszenia z szybkim przejściem do pełnego szczegółu.",
  },
  {
    href: "/archiwum",
    title: "Archiwum",
    description: "Zamknięte sprawy i historia wykonanych reklamacji.",
  },
];

const adminModules = [
  {
    href: "/trasy",
    title: "Lista tras",
    description: "Widok wszystkich tras z metrykami, statusami i logami.",
  },
  {
    href: "/trasy/nowa",
    title: "Utwórz trasę",
    description: "Mapa kandydatów, kolejność punktów, ETA i podsumowanie dystansu.",
  },
  {
    href: "/trasy/panel",
    title: "Panel kierowcy",
    description: "Dzisiejsze trasy do startu, realizacji i zamknięcia.",
  },
  {
    href: "/uzytkownicy",
    title: "Użytkownicy",
    description: "Zarządzanie dostępem do systemu i kontami firm.",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { profile, loading, error } = useCurrentProfile();

  useEffect(() => {
    if (error) {
      router.push("/login");
    }
  }, [error, router]);

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

  const modules =
    profile.role === ROLE.ADMIN
      ? [...baseModules, ...adminModules]
      : baseModules;

  return (
    <AppShell
      profile={profile}
      title="Dashboard"
      subtitle="Nowy układ modułów reklamacji i tras. Moduł mapa został zwinięty do współdzielonych widoków tras."
    >
      {modules.length ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="group rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                Moduł
              </div>
              <h2 className="mt-4 text-2xl font-bold text-slate-950">
                {module.title}
              </h2>
              <p className="mt-3 text-slate-600">{module.description}</p>
              <div className="mt-6 text-sm font-semibold text-slate-950">
                Otwórz →
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <ScreenState
          title="Brak modułów"
          description="Brak dostępnych modułów dla tego konta."
        />
      )}
    </AppShell>
  );
}

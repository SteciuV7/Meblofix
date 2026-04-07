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
    emoji: "\u{1F4CB}",
    description: "Biezace zgloszenia z szybkim przejsciem do pelnego szczegolu.",
  },
  {
    href: "/mapa",
    title: "Mapa",
    emoji: "\u{1F5FA}\uFE0F",
    description: "Wspolny widok punktow reklamacji na mapie dla firm i administratora.",
  },
  {
    href: "/archiwum",
    title: "Archiwum",
    emoji: "\u{1F5C4}\uFE0F",
    description: "Zamkniete sprawy i historia wykonanych reklamacji.",
  },
];

const adminModules = [
  {
    href: "/trasy",
    title: "Lista tras",
    emoji: "\u{1F69A}",
    description: "Widok wszystkich tras z metrykami, statusami i logami.",
  },
  {
    href: "/rozliczenia",
    title: "Rozliczenia",
    emoji: "\u{1F4C4}",
    description:
      "Okresowe zestawienia zakonczonych reklamacji z eksportem PDF dla wybranej firmy.",
  },
  {
    href: "/ustawienia",
    title: "Ustawienia",
    emoji: "\u2699\uFE0F",
    description: "Edycja aktywnej konfiguracji bazy operacyjnej dla planowania tras.",
  },
  {
    href: "/trasy/panel",
    title: "Panel kierowcy",
    emoji: "\u{1F697}",
    description: "Dzisiejsze trasy do startu, realizacji i zamkniecia.",
  },
  {
    href: "/uzytkownicy",
    title: "Uzytkownicy",
    emoji: "\u{1F465}",
    description: "Zarzadzanie dostepem do systemu i kontami firm.",
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
        Ladowanie...
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
      subtitle="Nowy uklad modulow reklamacji, mapy i tras z szybkim przejsciem do glownych widokow."
    >
      {modules.length ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="group rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-2xl font-bold text-slate-950">
                  {module.title}
                </h2>
                <div
                  className="shrink-0 text-3xl leading-none"
                  aria-hidden="true"
                  title={module.title}
                >
                  {module.emoji}
                </div>
              </div>
              <p className="mt-3 text-slate-600">{module.description}</p>
              <div className="mt-6 text-sm font-semibold text-slate-950">
                Otworz {"->"}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <ScreenState
          title="Brak modulow"
          description="Brak dostepnych modulow dla tego konta."
        />
      )}
    </AppShell>
  );
}

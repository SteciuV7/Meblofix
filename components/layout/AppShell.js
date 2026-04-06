import { APP_NAME, ROLE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const baseLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reklamacje", label: "Reklamacje" },
  { href: "/archiwum", label: "Archiwum" },
];

const adminLinks = [
  { href: "/trasy", label: "Trasy" },
  { href: "/ustawienia", label: "Ustawienia" },
  { href: "/trasy/nowa", label: "Utwórz trasę" },
  { href: "/trasy/panel", label: "Panel kierowcy" },
  { href: "/uzytkownicy", label: "Użytkownicy" },
];

function isLinkActive(pathname, href) {
  return (
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`))
  );
}

export function AppShell({
  profile,
  title,
  subtitle,
  children,
  actions,
  fullWidth = false,
  pageHeaderClassName = "",
  titleClassName = "",
  subtitleClassName = "",
  actionsClassName = "",
}) {
  const router = useRouter();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const links =
    profile?.role === ROLE.ADMIN
      ? [...baseLinks, ...adminLinks]
      : baseLinks;

  useEffect(() => {
    setProfileMenuOpen(false);
    setMobileNavOpen(false);
  }, [router.asPath]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-100 text-slate-900">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4 lg:items-center">
            <div>
              <button
                className="text-left"
                onClick={() => router.push("/dashboard")}
                type="button"
              >
                <div className="text-2xl font-bold tracking-tight">{APP_NAME}</div>
                <div className="text-sm text-slate-400">Ver. {APP_VERSION}</div>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 lg:hidden"
                onClick={() => setMobileNavOpen((current) => !current)}
                aria-label={mobileNavOpen ? "Zamknij menu" : "Otwórz menu"}
                aria-expanded={mobileNavOpen}
              >
                {mobileNavOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>

              <div className="relative">
                <button
                  type="button"
                  className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                  onClick={() => setProfileMenuOpen((current) => !current)}
                >
                  <span className="hidden sm:block">{profile?.email}</span>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 font-semibold text-white">
                    {profile?.email?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 top-full z-20 mt-3 w-64 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-xl">
                    <div className="mb-3">
                      <div className="font-semibold">
                        {profile?.nazwa_firmy || APP_NAME}
                      </div>
                      <div className="text-sm text-slate-500">{profile?.email}</div>
                    </div>
                    <button
                      type="button"
                      className="w-full rounded-xl bg-slate-900 px-4 py-2 text-left text-sm text-white hover:bg-slate-800"
                      onClick={async () => {
                        await supabase.auth.signOut();
                        router.push("/login");
                      }}
                    >
                      Wyloguj się
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <nav className="mt-4 hidden flex-wrap gap-2 lg:flex">
            {links.map((link) => {
              const isActive = isLinkActive(router.pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm transition",
                    isActive
                      ? "bg-white text-slate-950"
                      : "bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {mobileNavOpen ? (
            <div className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-3 lg:hidden">
              <nav className="flex flex-col gap-2">
                {links.map((link) => {
                  const isActive = isLinkActive(router.pathname, link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm transition",
                        isActive
                          ? "bg-white text-slate-950"
                          : "bg-white/10 text-white hover:bg-white/20"
                      )}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ) : null}
        </div>
      </header>

      <main
        className={cn(
          "mx-auto w-full max-w-full px-4 py-6 sm:px-6 sm:py-8",
          fullWidth ? "max-w-[1600px]" : "max-w-7xl"
        )}
      >
        <div
          className={cn(
            "mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between",
            pageHeaderClassName
          )}
        >
          <div>
            <h1
              className={cn(
                "text-3xl font-bold tracking-tight text-slate-950",
                titleClassName
              )}
            >
              {title}
            </h1>
            {subtitle ? (
              <p
                className={cn(
                  "mt-2 max-w-3xl text-slate-600",
                  subtitleClassName
                )}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className={cn("flex flex-wrap gap-3", actionsClassName)}>
              {actions}
            </div>
          ) : null}
        </div>
        {children}
      </main>
    </div>
  );
}

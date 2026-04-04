import { APP_NAME, ROLE } from "@/lib/constants";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

const baseLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reklamacje", label: "Reklamacje" },
  { href: "/archiwum", label: "Archiwum" },
];

const adminLinks = [
  { href: "/trasy", label: "Trasy" },
  { href: "/trasy/nowa", label: "Utwórz trasę" },
  { href: "/trasy/panel", label: "Panel kierowcy" },
  { href: "/uzytkownicy", label: "Użytkownicy" },
];

export function AppShell({
  profile,
  title,
  subtitle,
  children,
  actions,
  fullWidth = false,
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const links =
    profile?.role === ROLE.ADMIN
      ? [...baseLinks, ...adminLinks]
      : baseLinks;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
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
          <nav className="flex flex-wrap gap-2">
            {links.map((link) => {
              const isActive =
                router.pathname === link.href ||
                (link.href !== "/dashboard" &&
                  router.pathname.startsWith(`${link.href}/`));
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
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
              onClick={() => setOpen((current) => !current)}
            >
              <span className="hidden sm:block">{profile?.email}</span>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 font-semibold text-white">
                {profile?.email?.charAt(0)?.toUpperCase() || "?"}
              </span>
            </button>
            {open && (
              <div className="absolute right-0 top-full z-20 mt-3 w-64 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-xl">
                <div className="mb-3">
                  <div className="font-semibold">{profile?.nazwa_firmy || APP_NAME}</div>
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
      </header>

      <main className={cn("mx-auto px-6 py-8", fullWidth ? "max-w-[1600px]" : "max-w-7xl")}>
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              {title}
            </h1>
            {subtitle && <p className="mt-2 max-w-3xl text-slate-600">{subtitle}</p>}
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {children}
      </main>
    </div>
  );
}

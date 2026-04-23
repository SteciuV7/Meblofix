import { useRouter } from "next/router";
import { useEffect, useState } from "react";

async function fetchJson(path, options = {}) {
  const response = await fetch(path, options);
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(
      typeof payload === "string"
        ? payload
        : payload?.error || "Nie udalo sie zaladowac strony potwierdzenia."
    );
  }

  return payload;
}

export default function PublicSmsConfirmationPage() {
  const router = useRouter();
  const { token } = router.query;
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;

    async function load() {
      try {
        setLoading(true);
        const payload = await fetchJson(`/api/public/sms-confirmations/${token}`);
        if (!active) {
          return;
        }

        setDetail(payload);
        setError(null);
      } catch (err) {
        if (!active) {
          return;
        }

        setError(err.message || "Link potwierdzenia jest niewazny lub wygasl.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [token]);

  async function handleConfirm() {
    try {
      setConfirming(true);
      const payload = await fetchJson(
        `/api/public/sms-confirmations/${token}/confirm`,
        {
          method: "POST",
        }
      );
      setDetail(payload);
      setError(null);
    } catch (err) {
      setError(err.message || "Nie udalo sie potwierdzic terminu.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleCall() {
    if (!detail?.contactPhoneHref) {
      return;
    }

    try {
      setCalling(true);
      await fetch(`/api/public/sms-confirmations/${token}/call`, {
        method: "POST",
        keepalive: true,
      });
    } catch {
      // Ignorujemy blad logowania klikniecia, zeby nie blokowac polaczenia.
    } finally {
      window.location.href = detail.contactPhoneHref;
      setCalling(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center justify-center">
        <div className="w-full rounded-[2.25rem] border border-white/10 bg-white p-6 shadow-2xl sm:p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-400">
            Serwis meblowy
          </div>

          {loading ? (
            <div className="mt-6 rounded-[1.75rem] bg-slate-50 px-5 py-12 text-center text-slate-500">
              Ladowanie potwierdzenia...
            </div>
          ) : error ? (
            <div className="mt-6 space-y-4">
              <h1 className="text-3xl font-bold text-slate-950">Link wygasl</h1>
              <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                {error}
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-950">
                  Potwierdzenie terminu reklamacji
                </h1>
                <p className="mt-3 text-slate-600">
                  Prosimy o szybkie potwierdzenie zaplanowanego okna czasowego
                  albo kontakt telefoniczny.
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Zaplanowane okno
                </div>
                <div className="mt-3 text-2xl font-bold text-slate-950">
                  {detail.windowLabel}
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <div>Firma: {detail.companyName}</div>
                  {detail.customerName ? <div>Klient: {detail.customerName}</div> : null}
                  {detail.complaintNumber ? (
                    <div>Reklamacja: {detail.complaintNumber}</div>
                  ) : null}
                  {detail.address ? <div>Adres: {detail.address}</div> : null}
                  {detail.routeNumber ? <div>Trasa: {detail.routeNumber}</div> : null}
                </div>
              </div>

              {detail.status === "confirmed" ? (
                <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
                  Termin zostal juz potwierdzony. Dziekujemy.
                </div>
              ) : null}

              {detail.confirmationBlockedReason && detail.status !== "confirmed" ? (
                <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                  {detail.confirmationBlockedReason}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={confirming || !detail.canConfirm}
                  className="flex-1 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirming
                    ? "Potwierdzanie..."
                    : detail.canConfirm
                      ? "Potwierdzam termin"
                      : "Potwierdzenie niedostepne"}
                </button>
                <button
                  type="button"
                  onClick={handleCall}
                  disabled={calling || !detail.contactPhoneHref}
                  className="flex-1 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {calling
                    ? "Laczenie..."
                    : detail.contactPhone
                      ? `Zadzwon: ${detail.contactPhone}`
                      : "Brak numeru kontaktowego"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

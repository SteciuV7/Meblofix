import { getComplaintCustomerName, getPhoneHref } from "@/lib/utils";

export default function RouteUndeliverModal({
  isOpen,
  stop,
  loading = false,
  onClose,
  onConfirm,
}) {
  if (!isOpen || !stop) {
    return null;
  }

  const customerName = getComplaintCustomerName(stop.reklamacje);
  const customerPhoneHref = getPhoneHref(stop.reklamacje?.telefon_klienta);

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto bg-slate-950/55 px-4 py-6">
      <div className="mx-auto flex min-h-full max-w-lg items-center justify-center">
        <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">
                Niedostarczony punkt
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Potwierdz oznaczenie punktu
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Zamknij modal"
            >
              ×
            </button>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4">
            <div className="font-semibold text-slate-950">
              {stop.reklamacje?.nazwa_firmy || "Punkt trasy"}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {stop.reklamacje?.kod_pocztowy
                ? `${stop.reklamacje.kod_pocztowy} `
                : ""}
              {stop.reklamacje?.miejscowosc}
              {stop.reklamacje?.miejscowosc || stop.reklamacje?.adres ? ", " : ""}
              {stop.reklamacje?.adres}
            </div>
            {customerName || stop.reklamacje?.telefon_klienta ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                {customerName ? (
                  <span className="rounded-full bg-white px-3 py-1 font-medium ring-1 ring-rose-100">
                    {customerName}
                  </span>
                ) : null}
                {stop.reklamacje?.telefon_klienta ? (
                  <a
                    href={customerPhoneHref || "#"}
                    className="rounded-full bg-white px-3 py-1 font-medium text-rose-700 ring-1 ring-rose-100 hover:bg-rose-100"
                  >
                    {stop.reklamacje.telefon_klienta}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>

          <p className="mt-5 text-sm leading-6 text-slate-700">
            Po potwierdzeniu status punktu zostanie zmieniony na
            {" "}
            <span className="font-semibold text-slate-950">Niedostarczony</span>,
            a reklamacja wróci do statusu
            {" "}
            <span className="font-semibold text-slate-950">
              Oczekuje na dostawę
            </span>
            .
          </p>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Zapisywanie..." : "Oznacz jako niedostarczony"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

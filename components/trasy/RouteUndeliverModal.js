import { useEffect, useState } from "react";
import { getComplaintCustomerName, getPhoneHref } from "@/lib/utils";

export default function RouteUndeliverModal({
  isOpen,
  stop,
  loading = false,
  onClose,
  onConfirm,
}) {
  const [informacje, setInformacje] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setInformacje(stop?.reklamacje?.informacje || "");
    setSubmitError("");
  }, [isOpen, stop]);

  if (!isOpen || !stop) {
    return null;
  }

  const customerName = getComplaintCustomerName(stop.reklamacje);
  const customerPhoneHref = getPhoneHref(stop.reklamacje?.telefon_klienta);

  async function handleConfirm() {
    try {
      setSubmitError("");
      await onConfirm?.({
        informacje,
      });
    } catch (error) {
      setSubmitError(error.message || "Nie udalo sie zapisac zmiany statusu.");
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto bg-slate-950/55 px-4 py-6">
      <div className="mx-auto flex min-h-full max-w-xl items-center justify-center">
        <div
          className="w-full rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="route-undeliver-modal-title"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-700">
                {"Oczekuje na dostaw\u0119"}
              </div>
              <h2
                id="route-undeliver-modal-title"
                className="mt-2 text-2xl font-semibold text-slate-950"
              >
                {"Potwierd\u017a oznaczenie punktu"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Zamknij modal"
            >
              x
            </button>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-fuchsia-200 bg-fuchsia-50 p-4">
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
            {stop.reklamacje?.nazwa_mebla ? (
              <div className="mt-2 text-sm text-slate-700">
                Nazwa mebla: {stop.reklamacje.nazwa_mebla}
              </div>
            ) : null}
            {customerName || stop.reklamacje?.telefon_klienta ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                {customerName ? (
                  <span className="rounded-full bg-white px-3 py-1 font-medium ring-1 ring-fuchsia-100">
                    {customerName}
                  </span>
                ) : null}
                {stop.reklamacje?.telefon_klienta ? (
                  <a
                    href={customerPhoneHref || "#"}
                    className="rounded-full bg-white px-3 py-1 font-medium text-fuchsia-700 ring-1 ring-fuchsia-100 hover:bg-fuchsia-100"
                  >
                    {stop.reklamacje.telefon_klienta}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>

          <p className="mt-5 text-sm leading-6 text-slate-700">
            {"Po potwierdzeniu reklamacja wr\u00f3ci do statusu "}
            <span className="font-semibold text-slate-950">
              {"Oczekuje na dostaw\u0119"}
            </span>
            .
          </p>

          <label className="mt-5 block text-sm text-slate-700">
            Informacje od Meblofix
            <textarea
              className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100"
              value={informacje}
              onChange={(event) => {
                setInformacje(event.target.value);
                if (submitError) {
                  setSubmitError("");
                }
              }}
              placeholder="Opcjonalna informacja dla firmy zglaszajacej"
              disabled={loading}
            />
            <div className="mt-2 text-xs text-slate-500">
              To pole jest opcjonalne i bedzie widoczne na szczegolach reklamacji.
            </div>
          </label>

          {submitError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {"\u21A9\uFE0F Anuluj"}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="rounded-full bg-fuchsia-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Zapisywanie..." : "\u23F3 Oczekuje na dostaw\u0119"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

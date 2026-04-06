import { useEffect, useState } from "react";

export default function ComplaintAcceptModal({
  isOpen,
  reklamacja,
  loading = false,
  onClose,
  onSubmit,
}) {
  const [informacje, setInformacje] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setInformacje(reklamacja?.informacje || "");
    setSubmitError("");
  }, [isOpen, reklamacja]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen || !reklamacja) {
    return null;
  }

  async function handleSubmit() {
    try {
      setSubmitError("");
      await onSubmit?.({
        informacje,
      });
    } catch (error) {
      setSubmitError(error.message || "Nie udalo sie przyjac reklamacji.");
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto bg-slate-950/55 px-4 py-6">
      <div className="mx-auto flex min-h-full max-w-xl items-center justify-center">
        <div
          className="w-full rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="complaint-accept-modal-title"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
                Przyjecie reklamacji
              </div>
              <h2
                id="complaint-accept-modal-title"
                className="mt-2 text-2xl font-semibold text-slate-950"
              >
                Przyjmij reklamacje
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Zamknij modal przyjecia reklamacji"
            >
              x
            </button>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="font-semibold text-slate-950">
              {reklamacja.nazwa_firmy || "Reklamacja"}
            </div>
            <div className="mt-2">
              Numer: {reklamacja.nr_reklamacji || reklamacja.numer_faktury || "-"}
            </div>
            <div className="mt-1">
              Po zapisie status zmieni sie na{" "}
              <span className="font-semibold text-slate-950">
                W trakcie realizacji
              </span>
              .
            </div>
          </div>

          <label className="mt-5 block text-sm text-slate-700">
            Informacje od Meblofix
            <textarea
              className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              value={informacje}
              onChange={(event) => setInformacje(event.target.value)}
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
              Anuluj
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Przyjmowanie..." : "Przyjmij reklamacje"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

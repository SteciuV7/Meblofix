import { useEffect } from "react";

export default function ComplaintSmsRejectionModal({
  isOpen,
  message,
  loading = false,
  onClose,
}) {
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

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1100] overflow-y-auto bg-slate-950/65 px-4 py-6">
      <div className="mx-auto flex min-h-full max-w-2xl items-center justify-center">
        <div
          className="w-full rounded-[2rem] border border-rose-200 bg-white p-6 shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="complaint-sms-rejection-modal-title"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                Odmowa wizyty
              </div>
              <h2
                id="complaint-sms-rejection-modal-title"
                className="mt-2 text-2xl font-semibold text-slate-950"
              >
                Klient odrzucil termin z SMS
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Ta informacja wymaga zapoznania sie przed dalsza praca z
                reklamacja.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Zamknij informacje o odmowie wizyty"
            >
              x
            </button>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-rose-200 bg-rose-50 p-5 text-base font-medium text-rose-900">
            {message || "Klient odrzucil termin wizyty z SMS."}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Zapisywanie..." : "Rozumiem"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

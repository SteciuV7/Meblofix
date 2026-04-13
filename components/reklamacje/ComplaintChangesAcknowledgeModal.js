import { formatDate } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function ComplaintChangesAcknowledgeModal({
  isOpen,
  changes,
  loading = false,
  onClose,
  onConfirm,
}) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setChecked(false);
    }
  }, [isOpen]);

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

  const events = changes?.events || [];

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto bg-slate-950/55 px-4 py-6">
      <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
        <div
          className="w-full rounded-[2rem] border border-amber-200 bg-white p-6 shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="complaint-changes-modal-title"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                Nowe zmiany
              </div>
              <h2
                id="complaint-changes-modal-title"
                className="mt-2 text-2xl font-semibold text-slate-950"
              >
                Zapoznaj sie ze zmianami w reklamacji
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Ponizej widzisz zmiany wprowadzone przez Meblofix, system albo
                potwierdzenie SMS od ostatniego potwierdzenia.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Zamknij informacje o zmianach"
            >
              x
            </button>
          </div>

          <div className="mt-6 max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {events.length ? (
              events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="font-semibold text-slate-950">
                      {event.actionLabel}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDate(event.date, true)} | {event.source}
                    </div>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-xs uppercase tracking-[0.14em] text-slate-400">
                        <tr>
                          <th className="py-2 pr-4 font-semibold">Pole</th>
                          <th className="py-2 pr-4 font-semibold">Przed</th>
                          <th className="py-2 font-semibold">Po</th>
                        </tr>
                      </thead>
                      <tbody>
                        {event.changes.map((change, index) => (
                          <tr
                            key={`${event.id}-${change.fieldLabel}-${index}`}
                            className="border-t border-slate-200"
                          >
                            <td className="py-2 pr-4 font-semibold text-slate-700">
                              {change.fieldLabel}
                            </td>
                            <td className="max-w-[260px] whitespace-pre-wrap py-2 pr-4 text-slate-600">
                              {change.before}
                            </td>
                            <td className="max-w-[260px] whitespace-pre-wrap py-2 text-slate-950">
                              {change.after}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Ta reklamacja ma oznaczenie nowych zmian, ale nie ma juz
                szczegolow do pokazania.
              </div>
            )}
          </div>

          <label className="mt-6 flex items-start gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={checked}
              disabled={loading}
              onChange={(event) => setChecked(event.target.checked)}
            />
            <span>
              Potwierdzam, ze zapoznalem sie ze zmianami w tej reklamacji.
            </span>
          </label>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Zamknij
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading || !checked}
              className="rounded-full bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Zapisywanie..." : "Zapoznalem sie ze zmianami"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

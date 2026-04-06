import { formatDate } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function RouteRecalculateModal({
  isOpen,
  routeName,
  pointCount,
  plannedStartAt,
  loading = false,
  onClose,
  onConfirm,
}) {
  const [resetSmsConfirmations, setResetSmsConfirmations] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setResetSmsConfirmations(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto bg-slate-950/55 px-4 py-6">
      <div className="mx-auto flex min-h-full max-w-xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                Zapis zmian trasy
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Potwierdz edycje trasy
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

          <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="font-semibold text-slate-950">
              {routeName || "Trasa"}
            </div>
            <div className="mt-2">Punkty po zmianach: {pointCount}</div>
            <div className="mt-1">
              Planowany start: {plannedStartAt ? formatDate(plannedStartAt, true) : "-"}
            </div>
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={resetSmsConfirmations}
              onChange={(event) => setResetSmsConfirmations(event.target.checked)}
              disabled={loading}
            />
            <span>
              Zresetuj potwierdzenia SMS dla trasy. Wylaczy to dotychczasowe linki
              i odblokuje zbiorcza wysylke nowych potwierdzen po zapisie.
            </span>
          </label>

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
              onClick={() => onConfirm?.({ resetSmsConfirmations })}
              disabled={loading}
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Zapisywanie..." : "Zapisz zmiany trasy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

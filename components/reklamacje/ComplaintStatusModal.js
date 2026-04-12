import { StatusBadge } from "@/components/StatusBadge";
import {
  MANUAL_REKLAMACJA_DISABLED_STATUSES,
  REKLAMACJA_STATUS,
  REKLAMACJA_STATUS_OPTIONS,
} from "@/lib/constants";
import { getRouteDisplayName, labelForStatus } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function ComplaintStatusModal({
  isOpen,
  reklamacja,
  loading = false,
  onClose,
  onSubmit,
}) {
  const [selectedStatus, setSelectedStatus] = useState("");
  const [submitError, setSubmitError] = useState("");

  const activeRouteStop = reklamacja?.activeRouteStop || null;
  const isBlocked = Boolean(activeRouteStop);
  const statusOptions = useMemo(() => REKLAMACJA_STATUS_OPTIONS, []);

  useEffect(() => {
    if (!isOpen || !reklamacja) {
      return;
    }

    setSelectedStatus(reklamacja.status || "");
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

  const route = activeRouteStop?.trasy || null;
  const disabledTarget =
    MANUAL_REKLAMACJA_DISABLED_STATUSES.includes(selectedStatus);
  const unchanged = selectedStatus === reklamacja.status;
  let submitLabel = "Zapisz status";
  if (selectedStatus === REKLAMACJA_STATUS.DONE) {
    submitLabel = "Przejdz do zakonczenia";
  } else if (selectedStatus === REKLAMACJA_STATUS.WAITING_DELIVERY) {
    submitLabel = "Uzupelnij dane";
  }

  async function handleSubmit() {
    if (!selectedStatus || unchanged || disabledTarget) {
      return;
    }

    try {
      setSubmitError("");
      await onSubmit(selectedStatus);
    } catch (error) {
      setSubmitError(error.message || "Nie udalo sie zapisac statusu.");
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto bg-slate-950/55 px-4 py-6">
      <div className="mx-auto flex min-h-full max-w-xl items-center justify-center">
        <div
          className="w-full rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="complaint-status-modal-title"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                Status reklamacji
              </div>
              <h2
                id="complaint-status-modal-title"
                className="mt-2 text-2xl font-semibold text-slate-950"
              >
                Zmien status reklamacji
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Zamknij modal zmiany statusu"
            >
              x
            </button>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm text-slate-500">Aktualny status</div>
            <div className="mt-2">
              <StatusBadge value={reklamacja.status} />
            </div>
          </div>

          {isBlocked ? (
            <>
              <div className="mt-5 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
                <div className="font-semibold text-slate-950">
                  Ta reklamacja jest przypisana do aktywnej trasy.
                </div>
                <div className="mt-2">
                  Reczny zapis statusu jest zablokowany, dopoki punkt trasy ma
                  status{" "}
                  <span className="font-semibold text-slate-950">
                    {labelForStatus(activeRouteStop.status)}
                  </span>
                  .
                </div>
                {route ? (
                  <div className="mt-4 space-y-2">
                    <div>
                      Trasa:{" "}
                      <span className="font-semibold text-slate-950">
                        {getRouteDisplayName(route)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge value={route.status} />
                      <StatusBadge value={activeRouteStop.status} />
                    </div>
                    <div>
                      <Link
                        href={`/trasy/${route.id}`}
                        className="font-semibold text-indigo-700 hover:text-indigo-900"
                      >
                        Otworz trase
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Zamknij
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="mt-5 block text-sm text-slate-700">
                Nowy status
                <select
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  {statusOptions.map((status) => (
                    <option
                      key={status}
                      value={status}
                      disabled={MANUAL_REKLAMACJA_DISABLED_STATUSES.includes(
                        status
                      )}
                    >
                      {labelForStatus(status)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <div>
                  Statusy trasowe sa widoczne, ale nie mozna ich ustawic
                  recznie.
                </div>
                {selectedStatus === REKLAMACJA_STATUS.DONE ? (
                  <div>
                    Po wybraniu tego statusu otworzy sie formularz zakonczenia
                    reklamacji.
                  </div>
                ) : null}
                {selectedStatus === REKLAMACJA_STATUS.WAITING_DELIVERY ? (
                  <div>
                    Po wybraniu tego statusu otworzy sie formularz informacji i
                    danych do pozniejszego zakonczenia.
                  </div>
                ) : null}
              </div>

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
                  disabled={loading || unchanged || disabledTarget}
                  className="rounded-full bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Zapisywanie..." : submitLabel}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { SMS_CONFIRMATION_STATUS } from "@/lib/constants";
import { labelForStatus } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

const STATUS_THEMES = {
  [SMS_CONFIRMATION_STATUS.NOT_SENT]:
    "border-slate-300 bg-slate-300 text-slate-700",
  [SMS_CONFIRMATION_STATUS.SENT]: "border-amber-300 bg-amber-400 text-amber-900",
  [SMS_CONFIRMATION_STATUS.CONFIRMED]:
    "border-emerald-300 bg-emerald-500 text-emerald-950",
  [SMS_CONFIRMATION_STATUS.MANUAL_REJECTED]:
    "border-rose-300 bg-rose-500 text-rose-50",
};

const STATUS_OPTIONS = [
  SMS_CONFIRMATION_STATUS.NOT_SENT,
  SMS_CONFIRMATION_STATUS.SENT,
  SMS_CONFIRMATION_STATUS.CONFIRMED,
  SMS_CONFIRMATION_STATUS.MANUAL_REJECTED,
];

export default function RouteSmsStatusControl({
  status,
  disabled = false,
  loading = false,
  readOnly = false,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const activeStatus = status || SMS_CONFIRMATION_STATUS.NOT_SENT;
  const statusLabel = labelForStatus(activeStatus);
  const controlLabel = `Kolor potwierdzenia SMS: ${statusLabel}`;
  const interactive = !readOnly && typeof onChange === "function";
  const content = (
    <>
      <span
        className={`inline-flex h-3.5 w-3.5 rounded-full border ${STATUS_THEMES[activeStatus]}`}
      />
      <span>SMS ETA</span>
    </>
  );

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="group relative inline-flex">
      <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-lg group-hover:block group-focus-within:block">
        {controlLabel}
      </div>
      {interactive ? (
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-expanded={open}
          aria-label={controlLabel}
          title={controlLabel}
        >
          {content}
        </button>
      ) : (
        <div
          className="inline-flex cursor-default items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
          aria-label={controlLabel}
          title={controlLabel}
        >
          {content}
        </div>
      )}

      {interactive && open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Zmien lampke
          </div>
          <div className="mt-1 space-y-1">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                disabled={loading}
                onClick={() => {
                  setOpen(false);
                  onChange?.(option);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                  option === activeStatus ? "bg-slate-50" : ""
                }`}
              >
                <span
                  className={`inline-flex h-3.5 w-3.5 rounded-full border ${STATUS_THEMES[option]}`}
                />
                <span className="font-medium text-slate-700">
                  {labelForStatus(option)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

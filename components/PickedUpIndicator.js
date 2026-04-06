export function PickedUpIndicator({ checked, label }) {
  const theme = checked
    ? {
        wrapper: "border-emerald-200 bg-emerald-50 text-emerald-800",
        box: "border-emerald-300 bg-emerald-600 text-white",
        defaultLabel: "Odebrany",
      }
    : {
        wrapper: "border-rose-200 bg-rose-50 text-rose-800",
        box: "border-rose-300 bg-white text-rose-600",
        defaultLabel: "Nieodebrany",
      };

  return (
    <div
      className={`inline-flex items-center gap-3 rounded-2xl border px-3 py-2 text-sm font-semibold ${theme.wrapper}`}
    >
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-md border ${theme.box}`}
        aria-hidden="true"
      >
        {checked ? (
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 stroke-current">
            <path
              d="M4.5 10.5 8 14l7.5-8"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 stroke-current">
            <path
              d="m5 5 10 10M15 5 5 15"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span>{label || theme.defaultLabel}</span>
    </div>
  );
}

export default PickedUpIndicator;

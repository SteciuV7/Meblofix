import { cn, formatDuration, formatEtaDate } from "@/lib/utils";

export function RouteEtaBadge({ etaFrom, etaTo, className }) {
  if (!etaFrom) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-left shadow-sm",
        className
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
        ETA
      </div>
      <div className="mt-1 text-sm font-semibold text-emerald-950">
        {formatEtaDate(etaFrom)}
      </div>
      {etaTo ? (
        <div className="mt-1 text-xs text-emerald-700">
          Okno do {formatEtaDate(etaTo)}
        </div>
      ) : null}
    </div>
  );
}

export function RouteLegConnector({
  durationSeconds,
  className,
  label = "Dojazd do kolejnego punktu",
}) {
  if (durationSeconds == null) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-3 px-4 py-1 sm:px-6", className)}>
      <div className="h-8 w-px rounded-full bg-gradient-to-b from-slate-200 via-emerald-300 to-slate-200" />
      <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 shadow-sm">
        {label}: {formatDuration(durationSeconds)}
      </div>
    </div>
  );
}

export function RouteBaseCard({
  title,
  address,
  caption,
  etaFrom,
  etaTo,
  className,
}) {
  return (
    <div
      className={cn(
        "rounded-[1.5rem] border border-slate-300 bg-gradient-to-br from-slate-100 via-slate-100 to-sky-100 px-5 py-4 text-slate-950 shadow-sm",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-200 text-lg font-semibold text-sky-800">
            M
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Magazyn
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-950">{title}</div>
            <div className="mt-1 text-sm text-slate-600">
              {address || "Brak adresu magazynu"}
            </div>
            {caption ? (
              <div className="mt-2 text-xs font-medium text-slate-500">{caption}</div>
            ) : null}
          </div>
        </div>

        <RouteEtaBadge
          etaFrom={etaFrom}
          etaTo={etaTo}
          className="w-full sm:w-[220px]"
        />
      </div>
    </div>
  );
}

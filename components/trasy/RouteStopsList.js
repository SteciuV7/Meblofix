import { Children } from "react";
import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import {
  RouteBaseCard,
  RouteEtaBadge,
  RouteLegConnector,
} from "@/components/trasy/RouteTiming";
import {
  formatDate,
  getComplaintCustomerName,
  getPhoneHref,
} from "@/lib/utils";

function getComplaint(stop) {
  return stop?.reklamacje || stop || {};
}

export default function RouteStopsList({
  stops = [],
  routeBaseAddress,
  plannedStartAt,
  returnLegDurationSeconds,
  returnEtaAt,
  renderPointActions,
  renderPhoneAccessory,
  renderTimingAccessory,
  highlightedStopId = null,
}) {
  if (!stops.length) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
        Trasa nie ma jeszcze zadnych punktow.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <RouteBaseCard
        title="Start z magazynu"
        address={routeBaseAddress}
        caption={
          plannedStartAt
            ? `Planowany start: ${formatDate(plannedStartAt, true)}`
            : "Punkt poczatkowy trasy"
        }
      />

      {stops[0]?.duration_from_prev_s != null ? (
        <RouteLegConnector
          durationSeconds={stops[0].duration_from_prev_s}
          label="Dojazd z magazynu do punktu 1"
        />
      ) : null}

      {stops.map((stop, index) => {
        const complaint = getComplaint(stop);
        const customerName = getComplaintCustomerName(complaint);
        const customerPhoneHref = getPhoneHref(complaint.telefon_klienta);
        const pointActions = renderPointActions ? renderPointActions(stop, index) : null;
        const phoneAccessory = renderPhoneAccessory
          ? renderPhoneAccessory(stop, index)
          : null;
        const timingAccessory = renderTimingAccessory
          ? renderTimingAccessory(stop, index)
          : null;
        const hasPointActions = Children.count(pointActions) > 0;
        const isHighlighted = highlightedStopId && highlightedStopId === stop.id;

        return (
          <div key={stop.id || `${stop.reklamacja_id}-${index}`}>
            <div
              className={`rounded-3xl border p-4 transition ${
                isHighlighted
                  ? "border-sky-300 bg-sky-100/70 shadow-[0_0_0_1px_rgba(56,189,248,0.24)]"
                  : "border-slate-300 bg-slate-50"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm text-slate-500">{`Punkt ${index + 1}`}</div>
                  <div className="font-semibold text-slate-950">
                    {complaint.nazwa_firmy || "Brak nazwy firmy"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {complaint.kod_pocztowy ? `${complaint.kod_pocztowy} ` : ""}
                    {complaint.miejscowosc}
                    {complaint.miejscowosc || complaint.adres ? ", " : ""}
                    {complaint.adres}
                  </div>
                  {complaint.nazwa_mebla ? (
                    <div className="mt-2 text-sm text-slate-600">
                      Nazwa mebla: {complaint.nazwa_mebla}
                    </div>
                  ) : null}
                  {customerName || complaint.telefon_klienta ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Klient
                        </div>
                        <div className="mt-2 font-semibold text-slate-950">
                          {customerName || "-"}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-emerald-100/80 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                          Telefon
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="font-semibold text-emerald-950">
                            {complaint.telefon_klienta || "-"}
                          </div>
                          {complaint.telefon_klienta ? (
                            <a
                              href={customerPhoneHref || "#"}
                              aria-label={`Zadzwon do ${customerName || "klienta"}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100 hover:text-emerald-800"
                            >
                              <PhoneCall className="h-4 w-4" />
                            </a>
                          ) : null}
                          {phoneAccessory}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge value={stop.status} />
                    {complaint.status ? <StatusBadge value={complaint.status} /> : null}
                    {stop.reklamacja_id ? (
                      <Link
                        href={`/reklamacje/${stop.reklamacja_id}`}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        Reklamacja
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:items-end">
                  <RouteEtaBadge
                    etaFrom={stop.eta_from}
                    etaTo={stop.eta_to}
                    className="w-full sm:w-[220px]"
                  />
                  {timingAccessory}
                  {hasPointActions ? (
                    <div className="flex flex-wrap gap-2 sm:justify-end">{pointActions}</div>
                  ) : null}
                </div>
              </div>
            </div>

            {stops[index + 1] ? (
              <RouteLegConnector
                durationSeconds={stops[index + 1].duration_from_prev_s}
              />
            ) : null}
          </div>
        );
      })}

      {returnLegDurationSeconds != null ? (
        <RouteLegConnector
          durationSeconds={returnLegDurationSeconds}
          label="Dojazd do magazynu"
        />
      ) : null}
      <RouteBaseCard
        title="Powrot do magazynu"
        address={routeBaseAddress}
        caption="Punkt koncowy trasy"
        etaFrom={returnEtaAt}
      />
    </div>
  );
}

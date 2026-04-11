import { StatusBadge } from "@/components/StatusBadge";
import { getPublicStorageUrl } from "@/lib/storage";
import { calculateRemainingDays, formatDate } from "@/lib/utils";
import Link from "next/link";

function AttachmentPreview({ reklamacja }) {
  if (!reklamacja.zalacznik_pdf && !reklamacja.zalacznik_zdjecia?.length) {
    return <span className="text-slate-400">Brak</span>;
  }

  return (
    <div className="space-y-2">
      {reklamacja.zalacznik_pdf ? (
        <a
          href={getPublicStorageUrl(reklamacja.zalacznik_pdf)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-sky-700 hover:text-sky-900"
        >
          PDF
        </a>
      ) : null}
      {reklamacja.zalacznik_zdjecia?.length ? (
        <div className="text-xs text-slate-500">
          Zdjęcia: {reklamacja.zalacznik_zdjecia.length}
        </div>
      ) : null}
    </div>
  );
}

export function ReklamacjeTable({
  reklamacje,
  showFirma = false,
  showRoute = true,
  onStatusClick,
  canRowAction,
  onRowAction,
  rowActionBusyLabel = null,
  rowActionLabel = null,
  rowActionLoadingId = null,
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nr</th>
              {showFirma ? <th className="px-4 py-3 font-medium">Firma</th> : null}
              <th className="px-4 py-3 font-medium">Numer reklamacji</th>
              <th className="px-4 py-3 font-medium">Nazwa mebla</th>
              <th className="px-4 py-3 font-medium">Imię</th>
              <th className="px-4 py-3 font-medium">Nazwisko</th>
              <th className="px-4 py-3 font-medium">Telefon</th>
              <th className="px-4 py-3 font-medium">Miejsce</th>
              <th className="px-4 py-3 font-medium">Termin</th>
              <th className="px-4 py-3 font-medium">Pozostało</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {showRoute ? <th className="px-4 py-3 font-medium">Trasa</th> : null}
              <th className="px-4 py-3 font-medium">Załączniki</th>
              <th className="px-4 py-3 font-medium">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {reklamacje.map((reklamacja) => {
              const remaining = calculateRemainingDays(reklamacja.realizacja_do);
              const showRowAction =
                rowActionLabel &&
                onRowAction &&
                (typeof canRowAction === "function"
                  ? canRowAction(reklamacja)
                  : true);
              const rowActionLoading = rowActionLoadingId === reklamacja.id;

              return (
                <tr key={reklamacja.id} className="border-t border-slate-200 align-top">
                  <td className="px-4 py-4 font-medium text-slate-900">
                    {reklamacja.nr_reklamacji || "-"}
                  </td>
                  {showFirma ? (
                    <td className="px-4 py-4 text-slate-700">{reklamacja.nazwa_firmy}</td>
                  ) : null}
                  <td className="px-4 py-4 text-slate-700">
                    {reklamacja.numer_faktury || "-"}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {reklamacja.nazwa_mebla || "-"}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {reklamacja.imie_klienta || "-"}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {reklamacja.nazwisko_klienta || "-"}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {reklamacja.telefon_klienta || "-"}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    <div className="font-medium">{reklamacja.miejscowosc || "-"}</div>
                    <div className="text-xs text-slate-500">{reklamacja.adres || "-"}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {formatDate(reklamacja.realizacja_do)}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {remaining == null ? "-" : `${remaining} dni`}
                  </td>
                  <td className="px-4 py-4">
                    {onStatusClick ? (
                      <button
                        type="button"
                        onClick={() => onStatusClick(reklamacja)}
                        className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2"
                        aria-label={`Zmień status reklamacji ${reklamacja.nr_reklamacji || reklamacja.id}`}
                      >
                        <StatusBadge
                          value={reklamacja.status}
                          className="transition hover:brightness-95"
                        />
                      </button>
                    ) : (
                      <StatusBadge value={reklamacja.status} />
                    )}
                  </td>
                  {showRoute ? (
                    <td className="px-4 py-4 text-slate-700">
                      {reklamacja.trasa ? formatDate(reklamacja.trasa) : "-"}
                    </td>
                  ) : null}
                  <td className="px-4 py-4 text-slate-700">
                    <AttachmentPreview reklamacja={reklamacja} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/reklamacje/${reklamacja.id}`}
                        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        Szczegóły
                      </Link>
                      {showRowAction ? (
                        <button
                          type="button"
                          className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => onRowAction(reklamacja)}
                          disabled={rowActionLoading}
                        >
                          {rowActionLoading && rowActionBusyLabel
                            ? rowActionBusyLabel
                            : rowActionLabel}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

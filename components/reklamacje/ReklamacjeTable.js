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
  onRowAction,
  rowActionLabel = null,
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nr</th>
              {showFirma ? <th className="px-4 py-3 font-medium">Firma</th> : null}
              <th className="px-4 py-3 font-medium">Faktura</th>
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
              return (
                <tr key={reklamacja.id} className="border-t border-slate-200 align-top">
                  <td className="px-4 py-4 font-medium text-slate-900">
                    {reklamacja.nr_reklamacji || "—"}
                  </td>
                  {showFirma ? (
                    <td className="px-4 py-4 text-slate-700">{reklamacja.nazwa_firmy}</td>
                  ) : null}
                  <td className="px-4 py-4 text-slate-700">{reklamacja.numer_faktury}</td>
                  <td className="px-4 py-4 text-slate-700">
                    <div className="font-medium">{reklamacja.miejscowosc}</div>
                    <div className="text-xs text-slate-500">{reklamacja.adres}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {formatDate(reklamacja.realizacja_do)}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {remaining == null ? "—" : `${remaining} dni`}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge value={reklamacja.status} />
                  </td>
                  {showRoute ? (
                    <td className="px-4 py-4 text-slate-700">
                      {reklamacja.trasa ? formatDate(reklamacja.trasa) : "—"}
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
                      {rowActionLabel && onRowAction ? (
                        <button
                          type="button"
                          className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                          onClick={() => onRowAction(reklamacja)}
                        >
                          {rowActionLabel}
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

import PickedUpIndicator from "@/components/PickedUpIndicator";
import ImagePreviewModal from "@/components/reklamacje/ImagePreviewModal";
import StoredImageTile from "@/components/reklamacje/StoredImageTile";
import { StatusBadge } from "@/components/StatusBadge";
import { getPublicStorageUrl } from "@/lib/storage";
import { calculateRemainingDays, formatDate, safeArray } from "@/lib/utils";
import { X } from "lucide-react";
import { useState } from "react";

function formatRemainingTimeLabel(targetDate) {
  const days = calculateRemainingDays(targetDate);

  if (days == null) {
    return "-";
  }

  if (days === 1) {
    return "1 dzien";
  }

  return `${days} dni`;
}

export default function ComplaintPreviewModal({ complaint, onClose }) {
  const [previewImage, setPreviewImage] = useState(null);

  if (!complaint) {
    return null;
  }

  const images = safeArray(complaint.zalacznik_zdjecia);
  const complaintNumber =
    complaint.numer_faktury || complaint.nr_reklamacji || "-";

  return (
    <>
      <div
        className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="relative z-[1001] my-auto w-full max-w-5xl rounded-[2rem] bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Podglad reklamacji"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/95 p-2 text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-950"
            aria-label="Zamknij podglad reklamacji"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-semibold text-slate-950">
                  Podglad reklamacji
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {complaint.status ? <StatusBadge value={complaint.status} /> : null}
                  <PickedUpIndicator
                    checked={Boolean(complaint.element_odebrany)}
                    label={
                      complaint.element_odebrany
                        ? "Element odebrany"
                        : "Element nieodebrany"
                    }
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr),320px]">
              <div className="space-y-3 text-slate-800">
                <div>
                  <span className="font-semibold">Nazwa firmy:</span>{" "}
                  {complaint.nazwa_firmy || "-"}
                </div>
                <div>
                  <span className="font-semibold">Numer reklamacji:</span>{" "}
                  {complaintNumber}
                </div>
                <div>
                  <span className="font-semibold">Nazwa mebla:</span>{" "}
                  {complaint.nazwa_mebla || "-"}
                </div>
                <div>
                  <span className="font-semibold">Kod pocztowy:</span>{" "}
                  {complaint.kod_pocztowy || "-"}
                </div>
                <div>
                  <span className="font-semibold">Miejscowosc:</span>{" "}
                  {complaint.miejscowosc || "-"}
                </div>
                <div>
                  <span className="font-semibold">Adres:</span>{" "}
                  {[complaint.adres, complaint.kod_pocztowy, complaint.miejscowosc]
                    .filter(Boolean)
                    .join(", ") || "-"}
                </div>
                <div>
                  <span className="font-semibold">Opis:</span>{" "}
                  <span className="whitespace-pre-wrap">
                    {complaint.opis?.trim() || "-"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Termin realizacji:</span>{" "}
                  {formatDate(complaint.realizacja_do)}
                </div>
                <div>
                  <span className="font-semibold">Pozostaly czas:</span>{" "}
                  {formatRemainingTimeLabel(complaint.realizacja_do)}
                </div>
                <div>
                  <span className="font-semibold">Informacje od zglaszajacego:</span>{" "}
                  <span className="whitespace-pre-wrap">
                    {complaint.informacje_od_zglaszajacego?.trim() || "-"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Informacje od Meblofix:</span>{" "}
                  <span className="whitespace-pre-wrap">
                    {complaint.informacje?.trim() || "-"}
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="text-lg font-semibold text-slate-950">
                    Zalacznik PDF:
                  </div>
                  <div className="mt-3">
                    {complaint.zalacznik_pdf ? (
                      <a
                        href={getPublicStorageUrl(complaint.zalacznik_pdf)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-medium text-sky-700 hover:text-sky-900"
                      >
                        Otworz PDF
                      </a>
                    ) : (
                      <div className="text-sm text-slate-500">Brak zalacznika PDF.</div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-lg font-semibold text-slate-950">
                    Zalaczniki zdjeciowe:
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {images.length ? (
                      images.map((image) => (
                        <StoredImageTile
                          key={image}
                          path={image}
                          fallbackName="Zdjecie"
                          imageClassName="h-28"
                          onClick={setPreviewImage}
                        />
                      ))
                    ) : (
                      <div className="text-sm text-slate-500">
                        Brak zalacznikow zdjeciowych.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-400"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      </div>

      <ImagePreviewModal
        image={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </>
  );
}

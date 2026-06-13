import { ROLE } from "@/lib/constants";
import { AlertTriangle, CheckCircle2, MapPin, X } from "lucide-react";
import dynamic from "next/dynamic";

const RouteMap = dynamic(() => import("@/components/maps/RouteMap"), {
  ssr: false,
});

export function formatAddressLabel(requestedAddress = {}) {
  return [
    requestedAddress.addressLine,
    requestedAddress.postalCode,
    requestedAddress.town,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function ComplaintAddressPreviewModal({
  preview,
  profile,
  submitting = false,
  onClose,
  onConfirm,
}) {
  if (!preview) {
    return null;
  }

  if (preview.kind === "error") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="relative my-auto w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl max-h-[calc(100vh-2rem)]"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Blad geokodowania adresu"
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-10 rounded-full bg-white/95 p-2 text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-950"
            onClick={onClose}
            aria-label="Zamknij modal bledu adresu"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="p-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-rose-100 p-2 text-rose-700">
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div>
                <div className="text-xl font-semibold text-slate-950">
                  Nie udalo sie potwierdzic adresu
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Ten adres nie zostal wiarygodnie odnaleziony na mapie. Wroc
                  do edycji i popraw dane adresowe.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Wpisany adres
              </div>
              <div className="mt-2 flex items-start gap-2 text-slate-900">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                <span>{formatAddressLabel(preview.requestedAddress)}</span>
              </div>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {preview.message || "Nie udalo sie sprawdzic adresu."}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={onClose}
              >
                Wroc do edycji adresu
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!preview.geocode) {
    return null;
  }

  const isApproximate = preview.geocode.matchType === "approximate";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <div
        className="relative my-auto w-full max-w-6xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl max-h-[calc(100vh-2rem)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Potwierdzenie adresu reklamacji"
      >
        <button
          type="button"
          className="absolute right-4 top-4 z-10 rounded-full bg-white/95 p-2 text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onClose}
          aria-label="Zamknij podglad adresu"
          disabled={submitting}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr),380px]">
          <div className="bg-slate-50 p-4">
            <RouteMap
              height="480px"
              singlePointMaxZoom={15}
              showPickedUp={profile?.role === ROLE.ADMIN}
              stops={[
                {
                  id: "complaint-address-preview",
                  lat: preview.geocode.lat,
                  lon: preview.geocode.lon,
                  nazwa_firmy: isApproximate
                    ? "Przyblizony punkt reklamacji"
                    : "Adres reklamacji",
                  miejscowosc: preview.requestedAddress?.town,
                  adres: preview.geocode.formattedAddress,
                  tone: isApproximate ? "yellow" : "blue",
                },
              ]}
            />
          </div>

          <div className="border-t border-slate-200 p-6 lg:border-l lg:border-t-0">
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 rounded-full p-2 ${
                  isApproximate
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {isApproximate ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
              </div>

              <div>
                <div className="text-xl font-semibold text-slate-950">
                  {isApproximate
                    ? "Sprawdz przyblizony adres"
                    : "Potwierdz znaleziony adres"}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {isApproximate
                    ? "Google znalazl podobny punkt. Zatwierdz go tylko wtedy, gdy pinezka pokazuje wlasciwe miejsce."
                    : "Adres zostal odnaleziony dokladnie. Mozesz go potwierdzic i zapisac reklamacje."}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm text-slate-700">
              <div className="rounded-[1.5rem] bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Wpisany adres
                </div>
                <div className="mt-2 flex items-start gap-2 text-slate-900">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                  <span>{formatAddressLabel(preview.requestedAddress)}</span>
                </div>
              </div>

              <div className="rounded-[1.5rem] bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Znaleziony adres
                </div>
                <div className="mt-2 font-medium text-slate-900">
                  {preview.geocode.formattedAddress}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Typ wyniku: {preview.geocode.locationType || "brak"}
                </div>
              </div>

              {preview.geocode.warnings?.length ? (
                <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                    Roznice do sprawdzenia
                  </div>
                  <div className="mt-3 space-y-2">
                    {preview.geocode.warnings.map((warning) => (
                      <div key={warning}>{warning}</div>
                    ))}
                  </div>
                </div>
              ) : null}

              {preview.submitError ? (
                <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-rose-800">
                  {preview.submitError}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onConfirm}
                disabled={submitting}
              >
                {submitting
                  ? "Zapisywanie..."
                  : isApproximate
                    ? "Zatwierdz przyblizony adres i zapisz"
                    : "Potwierdz adres i zapisz"}
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onClose}
                disabled={submitting}
              >
                Wroc do edycji adresu
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

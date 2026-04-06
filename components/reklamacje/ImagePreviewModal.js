import { X } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";

export default function ImagePreviewModal({ image, onClose }) {
  useEffect(() => {
    if (!image?.url) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [image?.url, onClose]);

  if (!image?.url) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[1010] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={image.name || "Podglad zdjecia"}
      >
        <button
          type="button"
          className="absolute right-4 top-4 z-10 rounded-full bg-white/95 p-2 text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-950"
          onClick={onClose}
          aria-label="Zamknij podglad"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="bg-slate-950">
          <Image
            src={image.url}
            alt={image.name || "Podglad zdjecia"}
            width={1600}
            height={1200}
            unoptimized
            className="max-h-[75vh] w-full object-contain"
          />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-6 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {image.name || "Zdjecie"}
            </div>
            <div className="text-xs text-slate-500">
              Kliknij poza oknem lub nacisnij Esc, aby zamknac.
            </div>
          </div>
          <button
            type="button"
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            onClick={onClose}
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}

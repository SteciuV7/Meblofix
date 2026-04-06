import {
  AttachmentDropzone,
  isImageFile,
  isPdfFile,
  storagePathToFileName,
} from "@/components/reklamacje/AttachmentDropzone";
import { uploadFiles } from "@/components/reklamacje/FileUploadField";
import { getPublicStorageUrl } from "@/lib/storage";
import { X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

const IMAGE_SLOT_COUNT = 4;

function emptyImageSlots() {
  return Array.from({ length: IMAGE_SLOT_COUNT }, () => null);
}

function buildPdfAsset(path) {
  return path ? { kind: "existing", path } : null;
}

function buildImageAssets(paths = []) {
  const next = emptyImageSlots();

  paths.slice(0, IMAGE_SLOT_COUNT).forEach((path, index) => {
    if (!path) {
      return;
    }

    next[index] = { kind: "existing", path };
  });

  return next;
}

function getDisplayFile(asset, fallbackLabel) {
  if (!asset) {
    return null;
  }

  if (asset.kind === "new") {
    return asset.file;
  }

  return {
    name: storagePathToFileName(asset.path, fallbackLabel),
    size: 0,
  };
}

function hasCompletionContent({ description, pdfAsset, imageAssets }) {
  return Boolean(
    description.trim() ||
      pdfAsset ||
      imageAssets.some(Boolean)
  );
}

function buildModeMeta(mode) {
  if (mode === "edit") {
    return {
      title: "Edytuj zako\u0144czenie reklamacji",
      submitLabel: "Zapisz zmiany",
      helperText:
        "Mo\u017cesz zaktualizowa\u0107 opis przebiegu i za\u0142\u0105czniki po zako\u0144czeniu reklamacji.",
    };
  }

  if (mode === "deliver") {
    return {
      title: "Zako\u0144cz reklamacj\u0119",
      submitLabel: "Zako\u0144cz reklamacj\u0119",
      helperText:
        "Oznaczenie punktu jako dostarczony zamknie reklamacj\u0119 i zapisze dane zako\u0144czenia.",
    };
  }

  return {
    title: "Zako\u0144cz reklamacj\u0119",
    submitLabel: "Zako\u0144cz reklamacj\u0119",
    helperText:
      "Dodaj opis przebiegu albo przynajmniej jeden za\u0142\u0105cznik, aby zamkn\u0105\u0107 reklamacj\u0119.",
  };
}

export default function ComplaintCloseModal({
  initialValue,
  isOpen,
  mode = "close",
  onClose,
  onSubmit,
}) {
  const [description, setDescription] = useState("");
  const [pdfAsset, setPdfAsset] = useState(null);
  const [imageAssets, setImageAssets] = useState(emptyImageSlots);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [imagePreviewUrls, setImagePreviewUrls] = useState(
    emptyImageSlots().map(() => "")
  );
  const [previewImage, setPreviewImage] = useState(null);
  const [pdfError, setPdfError] = useState("");
  const [imageError, setImageError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const modeMeta = useMemo(() => buildModeMeta(mode), [mode]);
  const initialImagesKey = Array.isArray(initialValue?.zalacznik_zakonczenie)
    ? initialValue.zalacznik_zakonczenie.join("|")
    : "";
  const initialImagePaths = useMemo(
    () => (initialImagesKey ? initialImagesKey.split("|") : []),
    [initialImagesKey]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDescription(initialValue?.opis_przebiegu || "");
    setPdfAsset(buildPdfAsset(initialValue?.zalacznik_pdf_zakonczenie || null));
    setImageAssets(buildImageAssets(initialImagePaths));
    setPdfError("");
    setImageError("");
    setSubmitError("");
    setPreviewImage(null);
  }, [
    initialImagePaths,
    initialImagesKey,
    initialValue?.opis_przebiegu,
    initialValue?.zalacznik_pdf_zakonczenie,
    isOpen,
  ]);

  useEffect(() => {
    if (!pdfAsset) {
      setPdfPreviewUrl("");
      return undefined;
    }

    if (pdfAsset.kind === "existing") {
      setPdfPreviewUrl(getPublicStorageUrl(pdfAsset.path) || "");
      return undefined;
    }

    const nextUrl = URL.createObjectURL(pdfAsset.file);
    setPdfPreviewUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [pdfAsset]);

  useEffect(() => {
    const nextUrls = imageAssets.map((asset) => {
      if (!asset) {
        return "";
      }

      if (asset.kind === "existing") {
        return getPublicStorageUrl(asset.path) || "";
      }

      return URL.createObjectURL(asset.file);
    });

    setImagePreviewUrls(nextUrls);

    return () => {
      nextUrls.forEach((url, index) => {
        if (url && imageAssets[index]?.kind === "new") {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [imageAssets]);

  useEffect(() => {
    if (!isOpen || !previewImage) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (previewImage) {
          setPreviewImage(null);
          return;
        }

        if (!submitting) {
          onClose();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, previewImage, submitting]);

  if (!isOpen) {
    return null;
  }

  function handlePdfSelect(file) {
    if (!file) {
      setPdfAsset(null);
      setPdfError("");
      return;
    }

    if (!isPdfFile(file)) {
      setPdfError("Wgraj plik PDF.");
      return;
    }

    setPdfError("");
    setSubmitError("");
    setPdfAsset({ kind: "new", file });
  }

  function handleImageSelect(index, file) {
    if (!file) {
      setImageAssets((current) => {
        const next = [...current];
        next[index] = null;
        return next;
      });
      setImageError("");
      return;
    }

    if (!isImageFile(file)) {
      setImageError("Wgraj plik graficzny w formacie PNG, JPG, GIF lub SVG.");
      return;
    }

    setImageError("");
    setSubmitError("");
    setImageAssets((current) => {
      const next = [...current];
      next[index] = { kind: "new", file };
      return next;
    });
  }

  function handleImageRemove(index) {
    setImageAssets((current) => {
      const next = [...current];
      next[index] = null;
      return next;
    });
    setPreviewImage((current) => (current?.index === index ? null : current));
    setSubmitError("");
  }

  async function handleSubmit() {
    if (!hasCompletionContent({ description, pdfAsset, imageAssets })) {
      setSubmitError(
        "Dodaj opis przebiegu albo przynajmniej jeden za\u0142\u0105cznik."
      );
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError("");

      let pdfPath = null;
      if (pdfAsset?.kind === "existing") {
        pdfPath = pdfAsset.path;
      } else if (pdfAsset?.kind === "new") {
        const uploaded = await uploadFiles([pdfAsset.file], "pdfs");
        pdfPath = uploaded[0] || null;
      }

      const imagePaths = (
        await Promise.all(
          imageAssets.map(async (asset) => {
            if (!asset) {
              return null;
            }

            if (asset.kind === "existing") {
              return asset.path;
            }

            const uploaded = await uploadFiles([asset.file], "images");
            return uploaded[0] || null;
          })
        )
      ).filter(Boolean);

      await onSubmit({
        opis_przebiegu: description.trim(),
        zalacznik_pdf_zakonczenie: pdfPath,
        zalacznik_zakonczenie: imagePaths,
      });
    } catch (error) {
      setSubmitError(
        error?.message || "Nie uda\u0142o si\u0119 zapisa\u0107 danych zako\u0144czenia."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const closeDisabled = submitting;
  const selectedImagesCount = imageAssets.filter(Boolean).length;

  return (
    <>
      <div
        className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
        onClick={() => {
          if (!closeDisabled) {
            onClose();
          }
        }}
      >
        <div
          className="relative my-auto w-full max-w-5xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl max-h-[calc(100vh-2rem)]"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={modeMeta.title}
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-10 rounded-full bg-white/95 p-2 text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
            aria-label={"Zamknij modal zako\u0144czenia reklamacji"}
            disabled={closeDisabled}
          >
            <X className="h-5 w-5" />
          </button>

          <div className="p-6 sm:p-8">
            <div className="pr-12">
              <h2 className="text-2xl font-semibold text-slate-950">
                {modeMeta.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {modeMeta.helperText}
              </p>
            </div>

            <div className="mt-6 grid gap-6">
              <label className="block text-sm font-medium text-slate-800">
                {"Opis przebiegu reklamacji"}
                <textarea
                  className="mt-2 min-h-36 w-full rounded-[1.5rem] border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
                  placeholder={"Opisz przebieg reklamacji"}
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    setSubmitError("");
                  }}
                />
              </label>

              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {"Za\u0142\u0105cznik PDF (opcjonalny)"}
                </div>
                <div className="mt-2">
                  <AttachmentDropzone
                    accept="application/pdf"
                    error={pdfError}
                    file={getDisplayFile(pdfAsset, "zakonczenie.pdf")}
                    helperText="PDF do 2 MB"
                    inputId="complaint-close-pdf"
                    onRemoveFile={() => {
                      setPdfAsset(null);
                      setPdfError("");
                      setSubmitError("");
                    }}
                    onSelectFile={handlePdfSelect}
                    previewLabel={"Kliknij, aby otworzy\u0107 dokument w nowej karcie."}
                    previewUrl={pdfPreviewUrl}
                    title={"Wgraj PDF zako\u0144czenia lub przeci\u0105gnij tutaj"}
                    type="pdf"
                  />
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-800">
                    {"Zdj\u0119cia (maks. 4)"}
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    {`Dodano ${selectedImagesCount} z ${IMAGE_SLOT_COUNT}`}
                  </div>
                </div>

                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  {imageAssets.map((asset, index) => (
                    <AttachmentDropzone
                      key={`close-image-${index + 1}`}
                      accept="image/*"
                      error=""
                      file={getDisplayFile(asset, `zdjecie-${index + 1}.jpg`)}
                      helperText="PNG, JPG, GIF, SVG"
                      inputId={`complaint-close-image-${index + 1}`}
                      onOpenPreview={() =>
                        setPreviewImage({
                          index,
                          name:
                            getDisplayFile(asset, `Zdj\u0119cie ${index + 1}`)?.name ||
                            `Zdj\u0119cie ${index + 1}`,
                          url: imagePreviewUrls[index],
                        })
                      }
                      onRemoveFile={() => handleImageRemove(index)}
                      onSelectFile={(nextFile) => handleImageSelect(index, nextFile)}
                      previewLabel={"Kliknij, aby otworzy\u0107 podgl\u0105d."}
                      previewUrl={imagePreviewUrls[index]}
                      title={`Wgraj Zdj\u0119cie ${index + 1} lub przeci\u0105gnij tutaj`}
                      type="image"
                    />
                  ))}
                </div>

                {imageError ? (
                  <p className="mt-2 text-sm text-rose-500">{imageError}</p>
                ) : null}
              </div>

              {submitError ? (
                <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {submitError}
                </div>
              ) : null}
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onClose}
                disabled={closeDisabled}
              >
                Anuluj
              </button>
              <button
                type="button"
                className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Zapisywanie..." : modeMeta.submitLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      {previewImage?.url ? (
        <div
          className="fixed inset-0 z-[1010] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={previewImage.name}
          >
            <button
              type="button"
              className="absolute right-4 top-4 z-10 rounded-full bg-white/95 p-2 text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-950"
              onClick={() => setPreviewImage(null)}
              aria-label={"Zamknij podgl\u0105d"}
            >
              <X className="h-5 w-5" />
            </button>

            <div className="bg-slate-950">
              <Image
                src={previewImage.url}
                alt={previewImage.name}
                width={1600}
                height={1200}
                unoptimized
                className="max-h-[75vh] w-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-6 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {previewImage.name}
                </div>
                <div className="text-xs text-slate-500">
                  {"Kliknij poza oknem lub naci\u015bnij Esc, aby zamkn\u0105\u0107."}
                </div>
              </div>
              <button
                type="button"
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                onClick={() => setPreviewImage(null)}
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

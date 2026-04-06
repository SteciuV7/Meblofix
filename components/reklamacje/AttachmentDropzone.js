import { ExternalLink, FileText, Image as ImageIcon, UploadCloud, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export function isPdfFile(file) {
  return Boolean(
    file &&
      (file.type === "application/pdf" ||
        file.name?.toLowerCase().endsWith(".pdf"))
  );
}

export function isImageFile(file) {
  return Boolean(file && file.type?.startsWith("image/"));
}

function formatFileSize(size = 0) {
  if (!size) {
    return "";
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function storagePathToFileName(path = "", fallback = "plik") {
  const fileName = String(path).split("/").pop() || fallback;
  return fileName.replace(/^\d+-/, "");
}

export function AttachmentDropzone({
  accept,
  error,
  file,
  helperText,
  inputId,
  onOpenPreview,
  onRemoveFile,
  onSelectFile,
  previewLabel,
  previewUrl,
  title,
  type,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const isPdf = type === "pdf";

  function handleFileInputChange(event) {
    const nextFile = event.target.files?.[0] || null;
    onSelectFile(nextFile);
    event.target.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    onSelectFile(event.dataTransfer.files?.[0] || null);
  }

  const emptyStateClassName = [
    "group flex min-h-[156px] cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed px-6 py-8 text-center transition",
    isDragging
      ? "border-sky-400 bg-sky-50"
      : error
        ? "border-rose-300 bg-rose-50/70"
        : "border-slate-300 bg-white hover:border-sky-300 hover:bg-sky-50/40",
  ].join(" ");

  return (
    <div className="space-y-2">
      <input
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleFileInputChange}
      />

      {file ? (
        <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-50 shadow-sm">
          {isPdf ? (
            <a
              href={previewUrl || "#"}
              target="_blank"
              rel="noreferrer"
              className="block p-6 pr-28"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm ring-1 ring-slate-200">
                  <FileText className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-900">
                    {file.name}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {formatFileSize(file.size) || "PDF"}
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-600">
                    {"Otw\u00f3rz PDF w nowej karcie"}
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </a>
          ) : (
            <div className="relative">
              <button
                type="button"
                className="block w-full text-left"
                onClick={onOpenPreview}
              >
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt={file.name}
                    width={1200}
                    height={900}
                    unoptimized
                    className="h-56 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center bg-slate-100 text-slate-400">
                    <ImageIcon className="h-10 w-10" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent px-5 pb-5 pt-12 text-white">
                  <div className="truncate text-sm font-semibold">{file.name}</div>
                  <div className="mt-1 text-xs text-slate-200">{previewLabel}</div>
                </div>
              </button>
            </div>
          )}

          <div className="absolute right-3 top-3 z-10 flex gap-2">
            <label
              htmlFor={inputId}
              className="cursor-pointer rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-white"
            >
              {"Zmie\u0144"}
            </label>
            <button
              type="button"
              className="rounded-full bg-white/95 p-1.5 text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-900"
              onClick={onRemoveFile}
              aria-label={"Usu\u0144 plik"}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={emptyStateClassName}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
        >
          <UploadCloud className="h-8 w-8 text-sky-500 transition group-hover:scale-105" />
          <div className="mt-4 text-2xl font-semibold text-sky-600">{title}</div>
          <div className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-400">
            {helperText}
          </div>
        </label>
      )}

      {error ? <p className="text-sm text-rose-500">{error}</p> : null}
    </div>
  );
}

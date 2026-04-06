import { AppShell } from "@/components/layout/AppShell";
import { uploadFiles } from "@/components/reklamacje/FileUploadField";
import { ROLE } from "@/lib/constants";
import { apiFetch } from "@/lib/client-api";
import { supabase } from "@/lib/supabase";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { calculateRemainingDays } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  MapPin,
  UploadCloud,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const IMAGE_SLOT_COUNT = 4;
const RouteMap = dynamic(() => import("@/components/maps/RouteMap"), {
  ssr: false,
});

function emptyForm() {
  return {
    firma_id: "",
    nazwa_firmy: "",
    numer_faktury: "",
    imie_klienta: "",
    nazwisko_klienta: "",
    telefon_klienta: "",
    kod_pocztowy: "",
    miejscowosc: "",
    adres: "",
    opis: "",
    informacje_od_zglaszajacego: "",
    realizacja_do: "",
  };
}

function emptyImageSlots() {
  return Array.from({ length: IMAGE_SLOT_COUNT }, () => null);
}

function buildComplaintPayload({
  form,
  profile,
  firmy,
  pdfPath = null,
  imagePaths = [],
  addressApprovalMode = "exact",
}) {
  const selectedCompany =
    profile.role === ROLE.ADMIN
      ? firmy.find((firma) => firma.firma_id === form.firma_id)
      : profile;

  return {
    ...form,
    firma_id: profile.role === ROLE.ADMIN ? form.firma_id : profile.firma_id,
    nazwa_firmy:
      profile.role === ROLE.ADMIN
        ? selectedCompany?.nazwa_firmy || form.nazwa_firmy
        : profile.nazwa_firmy,
    zalacznik_pdf: pdfPath,
    zalacznik_zdjecia: imagePaths,
    addressApprovalMode,
    pozostaly_czas: calculateRemainingDays(form.realizacja_do),
    realizacja_do: form.realizacja_do
      ? new Date(form.realizacja_do).toISOString()
      : null,
  };
}

function formatAddressLabel(requestedAddress = {}) {
  return [
    requestedAddress.addressLine,
    requestedAddress.postalCode,
    requestedAddress.town,
  ]
    .filter(Boolean)
    .join(", ");
}

function buildRequestedAddress(form) {
  return {
    addressLine: form.adres,
    postalCode: form.kod_pocztowy,
    town: form.miejscowosc,
  };
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

function isPdfFile(file) {
  return Boolean(
    file &&
      (file.type === "application/pdf" ||
        file.name?.toLowerCase().endsWith(".pdf"))
  );
}

function isImageFile(file) {
  return Boolean(file && file.type?.startsWith("image/"));
}

function AttachmentDropzone({
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
                    Otwórz PDF w nowej karcie
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
              Zmień
            </label>
            <button
              type="button"
              className="rounded-full bg-white/95 p-1.5 text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-900"
              onClick={onRemoveFile}
              aria-label="Usuń plik"
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
          <div className="mt-2 text-sm tracking-[0.18em] text-slate-400 uppercase">
            {helperText}
          </div>
        </label>
      )}

      {error ? <p className="text-sm text-rose-500">{error}</p> : null}
    </div>
  );
}

export default function NewReklamacjaPage() {
  const router = useRouter();
  const { profile, loading, error } = useCurrentProfile();
  const [firmy, setFirmy] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [pdfFile, setPdfFile] = useState(null);
  const [imageFiles, setImageFiles] = useState(emptyImageSlots);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [imagePreviewUrls, setImagePreviewUrls] = useState(
    emptyImageSlots().map(() => "")
  );
  const [pdfError, setPdfError] = useState("");
  const [imageError, setImageError] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [addressPreview, setAddressPreview] = useState(null);
  const [previewingAddress, setPreviewingAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (error) {
      router.push("/login");
    }
  }, [error, router]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    if (profile.role !== ROLE.ADMIN) {
      setForm((current) => ({
        ...current,
        firma_id: profile.firma_id,
        nazwa_firmy: profile.nazwa_firmy,
      }));
      return;
    }

    let active = true;

    async function loadCompanies() {
      const { data, error: companiesError } = await supabase
        .from("firmy")
        .select("firma_id,nazwa_firmy,email")
        .order("nazwa_firmy", { ascending: true });

      if (companiesError || !active) {
        return;
      }

      setFirmy(data || []);
    }

    loadCompanies();

    return () => {
      active = false;
    };
  }, [profile]);

  useEffect(() => {
    if (!pdfFile) {
      setPdfPreviewUrl("");
      return undefined;
    }

    const nextUrl = URL.createObjectURL(pdfFile);
    setPdfPreviewUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [pdfFile]);

  useEffect(() => {
    const nextUrls = imageFiles.map((file) =>
      file ? URL.createObjectURL(file) : ""
    );

    setImagePreviewUrls(nextUrls);

    return () => {
      nextUrls.forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [imageFiles]);

  useEffect(() => {
    if (!previewImage) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setPreviewImage(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewImage]);

  useEffect(() => {
    if (!addressPreview || submitting) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setAddressPreview(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [addressPreview, submitting]);

  function handlePdfSelect(file) {
    if (!file) {
      setPdfFile(null);
      return;
    }

    if (!isPdfFile(file)) {
      setPdfError("Wgraj plik PDF.");
      return;
    }

    setPdfError("");
    setPdfFile(file);
  }

  function handlePdfRemove() {
    setPdfFile(null);
    setPdfPreviewUrl("");
  }

  function handleImageSelect(index, file) {
    if (!file) {
      setImageFiles((current) => {
        const next = [...current];
        next[index] = null;
        return next;
      });
      return;
    }

    if (!isImageFile(file)) {
      setImageError("Wgraj plik graficzny w formacie PNG, JPG, GIF lub SVG.");
      return;
    }

    setImageError("");
    setImageFiles((current) => {
      const next = [...current];
      next[index] = file;
      return next;
    });
  }

  function handleImageRemove(index) {
    setImageFiles((current) => {
      const next = [...current];
      next[index] = null;
      return next;
    });

    setPreviewImage((current) => (current?.index === index ? null : current));
  }

  function validateBeforeAddressPreview() {
    if (!pdfFile) {
      setPdfError("Zalacznik PDF jest wymagany.");
      return false;
    }

    setPdfError("");
    return true;
  }

  async function handlePreviewSubmit() {
    if (!validateBeforeAddressPreview()) {
      return;
    }

    try {
      setPreviewingAddress(true);
      const preview = await apiFetch("/api/reklamacje/geocode-preview", {
        method: "POST",
        body: JSON.stringify(
          buildComplaintPayload({
            form,
            profile,
            firmy,
          })
        ),
      });

      setAddressPreview({
        ...preview,
        kind: "geocode",
        submitError: "",
      });
    } catch (err) {
      setAddressPreview({
        kind: "error",
        requestedAddress: buildRequestedAddress(form),
        message: err.message || "Nie udalo sie sprawdzic adresu.",
      });
    } finally {
      setPreviewingAddress(false);
    }
  }

  async function handleConfirmAddress() {
    if (!addressPreview) {
      return;
    }

    try {
      setSubmitting(true);

      const selectedImageFiles = imageFiles.filter(Boolean);
      const [pdfPaths, imagePaths] = await Promise.all([
        uploadFiles([pdfFile], "pdfs"),
        uploadFiles(selectedImageFiles, "images"),
      ]);

      await apiFetch("/api/reklamacje", {
        method: "POST",
        body: JSON.stringify(
          buildComplaintPayload({
            form,
            profile,
            firmy,
            pdfPath: pdfPaths[0] || null,
            imagePaths,
            addressApprovalMode: addressPreview.geocode?.matchType || "exact",
          })
        ),
      });

      setAddressPreview(null);
      router.push("/reklamacje");
    } catch (err) {
      setAddressPreview((current) =>
        current
          ? {
              ...current,
              submitError:
                err.message || "Nie udalo sie utworzyc reklamacji.",
            }
          : current
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        Ładowanie...
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <>
      <AppShell
        profile={profile}
        title="Nowa reklamacja"
        subtitle="Adres i współrzędne zostaną policzone po stronie serwera, a samo zgłoszenie zapisze się przez nowe API."
        actions={
          <Link
            href="/reklamacje"
            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Wróć do listy
          </Link>
        }
      >
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            {profile.role === ROLE.ADMIN ? (
              <label className="block text-sm text-slate-700">
                Firma
                <select
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                  value={form.firma_id}
                  onChange={(event) => {
                    const selected = firmy.find(
                      (item) => item.firma_id === event.target.value
                    );

                    setForm((current) => ({
                      ...current,
                      firma_id: event.target.value,
                      nazwa_firmy: selected?.nazwa_firmy || "",
                    }));
                  }}
                >
                  <option value="">Wybierz firmę</option>
                  {firmy.map((firma) => (
                    <option key={firma.firma_id} value={firma.firma_id}>
                      {firma.nazwa_firmy || firma.email}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block text-sm text-slate-700">
              Numer reklamacji
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                value={form.numer_faktury}
                placeholder="Numer reklamacji"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    numer_faktury: event.target.value,
                  }))
                }
              />
            </label>

            <label className="block text-sm text-slate-700">
              Imie klienta
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                value={form.imie_klienta}
                placeholder="Imie klienta"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    imie_klienta: event.target.value,
                  }))
                }
              />
            </label>

            <label className="block text-sm text-slate-700">
              Nazwisko klienta
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                value={form.nazwisko_klienta}
                placeholder="Nazwisko klienta"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    nazwisko_klienta: event.target.value,
                  }))
                }
              />
            </label>

            <label className="block text-sm text-slate-700 md:col-span-2">
              Numer telefonu klienta
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                value={form.telefon_klienta}
                placeholder="+48 123 456 789"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    telefon_klienta: event.target.value,
                  }))
                }
              />
            </label>

            <label className="block text-sm text-slate-700">
              Kod pocztowy
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                value={form.kod_pocztowy}
                placeholder="Kod pocztowy (XX-XXX)"
                onChange={(event) => {
                  setAddressPreview(null);
                  setForm((current) => ({
                    ...current,
                    kod_pocztowy: event.target.value,
                  }));
                }}
              />
            </label>

            <label className="block text-sm text-slate-700">
              Miejscowość
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                value={form.miejscowosc}
                placeholder="Miasto"
                onChange={(event) => {
                  setAddressPreview(null);
                  setForm((current) => ({
                    ...current,
                    miejscowosc: event.target.value,
                  }));
                }}
              />
            </label>

            <label className="block text-sm text-slate-700 md:col-span-2">
              Adres
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                value={form.adres}
                placeholder="Nazwa ulicy + numer (np. Jana III Sobieskiego 12A/4)"
                onChange={(event) => {
                  setAddressPreview(null);
                  setForm((current) => ({
                    ...current,
                    adres: event.target.value,
                  }));
                }}
              />
            </label>

            <label className="block text-sm text-slate-700 md:col-span-2">
              Opis
              <textarea
                className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3"
                value={form.opis}
                placeholder="Opis reklamacji"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    opis: event.target.value,
                  }))
                }
              />
            </label>

            <label className="block text-sm text-slate-700 md:col-span-2">
              Informacje od zgłaszającego
              <textarea
                className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3"
                value={form.informacje_od_zglaszajacego}
                placeholder="Informacje od zgłaszającego"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    informacje_od_zglaszajacego: event.target.value,
                  }))
                }
              />
            </label>

            <label className="block text-sm text-slate-700">
              Termin realizacji
              <input
                type="datetime-local"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                value={form.realizacja_do}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    realizacja_do: event.target.value,
                  }))
                }
              />
            </label>

            <div className="md:col-span-2">
              <div className="text-sm font-semibold text-slate-800">
                Załącznik PDF (wymagany)
              </div>
              <div className="mt-2">
                <AttachmentDropzone
                  accept="application/pdf"
                  error={pdfError}
                  file={pdfFile}
                  helperText="PDF"
                  inputId="reklamacja-pdf"
                  onRemoveFile={handlePdfRemove}
                  onSelectFile={handlePdfSelect}
                  previewLabel="Kliknij, aby otworzyć dokument w nowej karcie."
                  previewUrl={pdfPreviewUrl}
                  title="Wgraj PDF lub przeciągnij tutaj"
                  type="pdf"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-800">
                  Załączniki zdjęciowe (opcjonalne)
                </div>
                <div className="text-xs font-medium text-slate-500">
                  Dodano {imageFiles.filter(Boolean).length} z {IMAGE_SLOT_COUNT}
                </div>
              </div>

              <div className="mt-2 grid gap-3 md:grid-cols-2">
                {imageFiles.map((file, index) => (
                  <AttachmentDropzone
                    key={`image-slot-${index + 1}`}
                    accept="image/*"
                    error=""
                    file={file}
                    helperText="PNG, JPG, GIF, SVG"
                    inputId={`reklamacja-image-${index + 1}`}
                    onOpenPreview={() =>
                      setPreviewImage({
                        index,
                        name: file?.name || `Zdjęcie ${index + 1}`,
                        url: imagePreviewUrls[index],
                      })
                    }
                    onRemoveFile={() => handleImageRemove(index)}
                    onSelectFile={(nextFile) => handleImageSelect(index, nextFile)}
                    previewLabel="Kliknij, aby otworzyć podgląd."
                    previewUrl={imagePreviewUrls[index]}
                    title={`Wgraj Zdjęcie ${index + 1} lub przeciągnij tutaj`}
                    type="image"
                  />
                ))}
              </div>

              {imageError ? (
                <p className="mt-2 text-sm text-rose-500">{imageError}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Link
              href="/reklamacje"
              className="rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Anuluj
            </Link>
            <button
              type="button"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handlePreviewSubmit}
              disabled={submitting || previewingAddress}
            >
              {previewingAddress
                ? "Sprawdzam adres..."
                : submitting
                  ? "Zapisywanie..."
                  : "Zapisz reklamację"}
            </button>
          </div>
        </section>
      </AppShell>

      {addressPreview?.kind === "error" ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setAddressPreview(null)}
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
              onClick={() => setAddressPreview(null)}
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
                    Ten adres nie zostal wiarygodnie odnaleziony na mapie.
                    Wroc do edycji i popraw dane adresowe.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[1.5rem] bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Wpisany adres
                </div>
                <div className="mt-2 flex items-start gap-2 text-slate-900">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                  <span>{formatAddressLabel(addressPreview.requestedAddress)}</span>
                </div>
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                {addressPreview.message || "Nie udalo sie sprawdzic adresu."}
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  onClick={() => setAddressPreview(null)}
                >
                  Wroc do edycji adresu
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {addressPreview?.geocode ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!submitting) {
              setAddressPreview(null);
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
              onClick={() => setAddressPreview(null)}
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
                  stops={[
                    {
                      id: "complaint-address-preview",
                      lat: addressPreview.geocode.lat,
                      lon: addressPreview.geocode.lon,
                      nazwa_firmy:
                        addressPreview.geocode.matchType === "approximate"
                          ? "Przyblizony punkt reklamacji"
                          : "Adres reklamacji",
                      miejscowosc: addressPreview.requestedAddress?.town,
                      adres: addressPreview.geocode.formattedAddress,
                      tone:
                        addressPreview.geocode.matchType === "approximate"
                          ? "yellow"
                          : "blue",
                    },
                  ]}
                />
              </div>

              <div className="border-t border-slate-200 p-6 lg:border-l lg:border-t-0">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 rounded-full p-2 ${
                      addressPreview.geocode.matchType === "approximate"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {addressPreview.geocode.matchType === "approximate" ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                  </div>

                  <div>
                    <div className="text-xl font-semibold text-slate-950">
                      {addressPreview.geocode.matchType === "approximate"
                        ? "Sprawdz przyblizony adres"
                        : "Potwierdz znaleziony adres"}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {addressPreview.geocode.matchType === "approximate"
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
                      <span>{formatAddressLabel(addressPreview.requestedAddress)}</span>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Znaleziony adres
                    </div>
                    <div className="mt-2 font-medium text-slate-900">
                      {addressPreview.geocode.formattedAddress}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Typ wyniku: {addressPreview.geocode.locationType || "brak"}
                    </div>
                  </div>

                  {addressPreview.geocode.warnings?.length ? (
                    <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-amber-900">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                        Roznice do sprawdzenia
                      </div>
                      <div className="mt-3 space-y-2">
                        {addressPreview.geocode.warnings.map((warning) => (
                          <div key={warning}>{warning}</div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {addressPreview.submitError ? (
                    <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-rose-800">
                      {addressPreview.submitError}
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleConfirmAddress}
                    disabled={submitting}
                  >
                    {submitting
                      ? "Zapisywanie..."
                      : addressPreview.geocode.matchType === "approximate"
                        ? "Zatwierdz przyblizony adres i zapisz"
                        : "Potwierdz adres i zapisz"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => setAddressPreview(null)}
                    disabled={submitting}
                  >
                    Wroc do edycji adresu
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {previewImage?.url ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
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
              aria-label="Zamknij podgląd"
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
                  Kliknij poza oknem lub naciśnij Esc, aby zamknąć.
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

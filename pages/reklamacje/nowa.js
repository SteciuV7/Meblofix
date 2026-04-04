import { AppShell } from "@/components/layout/AppShell";
import { uploadFiles } from "@/components/reklamacje/FileUploadField";
import { ROLE } from "@/lib/constants";
import { apiFetch } from "@/lib/client-api";
import { supabase } from "@/lib/supabase";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { calculateRemainingDays } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

function emptyForm() {
  return {
    firma_id: "",
    nazwa_firmy: "",
    numer_faktury: "",
    kod_pocztowy: "",
    miejscowosc: "",
    adres: "",
    opis: "",
    informacje_od_zglaszajacego: "",
    realizacja_do: "",
  };
}

export default function NewReklamacjaPage() {
  const router = useRouter();
  const { profile, loading, error } = useCurrentProfile();
  const [firmy, setFirmy] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [pdfFile, setPdfFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (error) {
      router.push("/login");
    }
  }, [error, router]);

  useEffect(() => {
    if (!profile) return;
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
      const { data, error } = await supabase
        .from("firmy")
        .select("firma_id,nazwa_firmy,email")
        .order("nazwa_firmy", { ascending: true });

      if (error || !active) return;
      setFirmy(data || []);
    }

    loadCompanies();
    return () => {
      active = false;
    };
  }, [profile]);

  async function handleSubmit() {
    try {
      setSubmitting(true);

      const [pdfPaths, imagePaths] = await Promise.all([
        pdfFile ? uploadFiles([pdfFile], "pdfs") : Promise.resolve([]),
        uploadFiles(imageFiles, "images"),
      ]);

      const selectedCompany =
        profile.role === ROLE.ADMIN
          ? firmy.find((firma) => firma.firma_id === form.firma_id)
          : profile;

      await apiFetch("/api/reklamacje", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          firma_id:
            profile.role === ROLE.ADMIN ? form.firma_id : profile.firma_id,
          nazwa_firmy:
            profile.role === ROLE.ADMIN
              ? selectedCompany?.nazwa_firmy || form.nazwa_firmy
              : profile.nazwa_firmy,
          zalacznik_pdf: pdfPaths[0] || null,
          zalacznik_zdjecia: imagePaths,
          pozostaly_czas: calculateRemainingDays(form.realizacja_do),
          realizacja_do: form.realizacja_do
            ? new Date(form.realizacja_do).toISOString()
            : null,
        }),
      });

      router.push("/reklamacje");
    } catch (err) {
      alert(err.message || "Nie udało się utworzyć reklamacji.");
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
    <AppShell
      profile={profile}
      title="Nowa reklamacja"
      subtitle="Adres i współrzędne zostaną policzone po stronie serwera, a samo zgłoszenie zapisze się już przez nowe API."
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
            Numer faktury
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={form.numer_faktury}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  numer_faktury: event.target.value,
                }))
              }
            />
          </label>

          <label className="block text-sm text-slate-700">
            Kod pocztowy
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={form.kod_pocztowy}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  kod_pocztowy: event.target.value,
                }))
              }
            />
          </label>

          <label className="block text-sm text-slate-700">
            Miejscowość
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={form.miejscowosc}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  miejscowosc: event.target.value,
                }))
              }
            />
          </label>

          <label className="block text-sm text-slate-700 md:col-span-2">
            Adres
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={form.adres}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  adres: event.target.value,
                }))
              }
            />
          </label>

          <label className="block text-sm text-slate-700 md:col-span-2">
            Opis
            <textarea
              className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={form.opis}
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

          <label className="block text-sm text-slate-700">
            PDF
            <input
              type="file"
              accept="application/pdf"
              className="mt-2 w-full rounded-2xl border border-dashed border-slate-200 px-4 py-3"
              onChange={(event) => setPdfFile(event.target.files?.[0] || null)}
            />
          </label>

          <label className="block text-sm text-slate-700 md:col-span-2">
            Zdjęcia
            <input
              type="file"
              accept="image/*"
              multiple
              className="mt-2 w-full rounded-2xl border border-dashed border-slate-200 px-4 py-3"
              onChange={(event) =>
                setImageFiles(Array.from(event.target.files || []))
              }
            />
            {imageFiles.length ? (
              <div className="mt-2 text-xs text-slate-500">
                Wybrane pliki: {imageFiles.map((file) => file.name).join(", ")}
              </div>
            ) : null}
          </label>
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
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Zapisywanie..." : "Zapisz reklamację"}
          </button>
        </div>
      </section>
    </AppShell>
  );
}

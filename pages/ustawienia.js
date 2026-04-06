import { AppShell } from "@/components/layout/AppShell";
import { ScreenState } from "@/components/layout/ScreenState";
import { DEFAULT_OPERATIONAL_SETTINGS, ROLE } from "@/lib/constants";
import { apiFetch } from "@/lib/client-api";
import { useCurrentProfile } from "@/lib/use-current-profile";
import {
  formatDate,
  normalizePolishPhoneNumber,
  removePolishCharacters,
} from "@/lib/utils";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const EMPTY_FORM = {
  id: "",
  nazwa: "",
  adres_bazy: "",
  lat: "",
  lon: "",
  domyslny_czas_obslugi_min: "",
  szerokosc_okna_min: "",
  sms_kontakt_telefon: "",
  sms_szablon_potwierdzenia:
    DEFAULT_OPERATIONAL_SETTINGS.sms_szablon_potwierdzenia,
  sms_szablon_startu_trasy: DEFAULT_OPERATIONAL_SETTINGS.sms_szablon_startu_trasy,
};

const SAMPLE_SMS_VALUES = {
  okno: "08.04 10:00-11:00",
  link: "https://idz.do/abc123",
  telefon: "+48 123 456 789",
};

function settingsToForm(settings) {
  if (!settings) {
    return EMPTY_FORM;
  }

  return {
    id: settings.id || "",
    nazwa: settings.nazwa || "",
    adres_bazy: settings.adres_bazy || "",
    lat: settings.lat == null ? "" : String(settings.lat),
    lon: settings.lon == null ? "" : String(settings.lon),
    domyslny_czas_obslugi_min:
      settings.domyslny_czas_obslugi_min == null
        ? ""
        : String(settings.domyslny_czas_obslugi_min),
    szerokosc_okna_min:
      settings.szerokosc_okna_min == null
        ? ""
        : String(settings.szerokosc_okna_min),
    sms_kontakt_telefon: settings.sms_kontakt_telefon || "",
    sms_szablon_potwierdzenia:
      settings.sms_szablon_potwierdzenia ||
      DEFAULT_OPERATIONAL_SETTINGS.sms_szablon_potwierdzenia,
    sms_szablon_startu_trasy:
      settings.sms_szablon_startu_trasy ||
      DEFAULT_OPERATIONAL_SETTINGS.sms_szablon_startu_trasy,
  };
}

function areFormsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function renderSmsPreview(template, variables) {
  let preview = removePolishCharacters(template || "");

  Object.entries(variables).forEach(([key, value]) => {
    preview = preview.split(`{{${key}}}`).join(value || "");
  });

  return preview
    .replace(/{{[^}]+}}/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s([,.!?;:])/g, "$1")
    .trim();
}

export default function SettingsPage() {
  const router = useRouter();
  const { profile, loading, error } = useCurrentProfile();
  const [savedSettings, setSavedSettings] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
      router.replace("/dashboard");
      return;
    }

    let active = true;

    async function loadSettings() {
      try {
        setLoadingSettings(true);
        const response = await apiFetch("/api/ustawienia-operacyjne");
        if (!active) {
          return;
        }

        setSavedSettings(response.settings || null);
        setForm(settingsToForm(response.settings));
        setLoadError(null);
      } catch (err) {
        if (!active) {
          return;
        }

        setLoadError(err.message || "Nie udalo sie pobrac ustawien operacyjnych.");
      } finally {
        if (active) {
          setLoadingSettings(false);
        }
      }
    }

    loadSettings();

    return () => {
      active = false;
    };
  }, [profile, refreshKey, router]);

  const pristineForm = useMemo(() => settingsToForm(savedSettings), [savedSettings]);
  const isDirty = !areFormsEqual(form, pristineForm);
  const normalizedContactPhone = normalizePolishPhoneNumber(form.sms_kontakt_telefon || "");

  const confirmationPreview = useMemo(
    () =>
      renderSmsPreview(form.sms_szablon_potwierdzenia, {
        ...SAMPLE_SMS_VALUES,
        telefon: normalizedContactPhone || SAMPLE_SMS_VALUES.telefon,
      }),
    [form.sms_szablon_potwierdzenia, normalizedContactPhone]
  );

  const routeStartPreview = useMemo(
    () =>
      renderSmsPreview(form.sms_szablon_startu_trasy, {
        ...SAMPLE_SMS_VALUES,
        telefon: normalizedContactPhone || SAMPLE_SMS_VALUES.telefon,
      }),
    [form.sms_szablon_startu_trasy, normalizedContactPhone]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        Ladowanie...
      </div>
    );
  }

  if (!profile || profile.role !== ROLE.ADMIN) {
    return null;
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
    setSaveError(null);
    setSaveSuccess(null);
  }

  function handleReset() {
    setForm(pristineForm);
    setSaveError(null);
    setSaveSuccess(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(null);

      const response = await apiFetch("/api/ustawienia-operacyjne", {
        method: "PATCH",
        body: JSON.stringify(form),
      });

      setSavedSettings(response.settings || null);
      setForm(settingsToForm(response.settings));
      setSaveSuccess("Ustawienia zostaly zapisane.");
    } catch (err) {
      setSaveError(err.message || "Nie udalo sie zapisac ustawien.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      profile={profile}
      title="Ustawienia"
      subtitle="Konfiguracja aktywnej bazy operacyjnej, ETA i szablonow SMS dla klienta."
    >
      {loadingSettings ? (
        <ScreenState
          title="Ladowanie ustawien"
          description="Pobieramy aktywna konfiguracje operacyjna."
        />
      ) : loadError ? (
        <ScreenState
          title="Nie udalo sie wczytac ustawien"
          description={loadError}
          action={
            <button
              type="button"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              Sprobuj ponownie
            </button>
          }
        />
      ) : !savedSettings ? (
        <ScreenState
          title="Brak aktywnej konfiguracji"
          description="W tabeli ustawienia_operacyjne nie znaleziono aktywnego wpisu."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),380px]">
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm"
          >
            <section>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Aktywna konfiguracja</h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    Zmiany zapisane tutaj trafia do aktywnego wpisu w tabeli
                    `ustawienia_operacyjne` i beda od razu wykorzystywane przez
                    planowanie tras oraz powiadomienia SMS.
                  </p>
                </div>
                <div className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-semibold text-emerald-700">
                  {savedSettings.aktywny ? "Aktywny wpis" : "Nieaktywny wpis"}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-slate-700 md:col-span-2">
                  Nazwa konfiguracji
                  <input
                    name="nazwa"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
                    value={form.nazwa}
                    onChange={handleFieldChange}
                    placeholder="Np. Baza Kepno"
                  />
                </label>

                <label className="text-sm text-slate-700 md:col-span-2">
                  Adres bazy
                  <textarea
                    name="adres_bazy"
                    className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
                    value={form.adres_bazy}
                    onChange={handleFieldChange}
                    placeholder="Pelny adres startowy dla tras"
                  />
                </label>

                <label className="text-sm text-slate-700">
                  Szerokosc geograficzna
                  <input
                    name="lat"
                    inputMode="decimal"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
                    value={form.lat}
                    onChange={handleFieldChange}
                    placeholder="51.277840"
                  />
                  <div className="mt-2 text-xs text-slate-500">
                    Mozesz wpisac liczbe z kropka lub przecinkiem.
                  </div>
                </label>

                <label className="text-sm text-slate-700">
                  Dlugosc geograficzna
                  <input
                    name="lon"
                    inputMode="decimal"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
                    value={form.lon}
                    onChange={handleFieldChange}
                    placeholder="17.983183"
                  />
                  <div className="mt-2 text-xs text-slate-500">
                    Wspolrzedne sa wykorzystywane jako punkt startu i powrotu.
                  </div>
                </label>

                <label className="text-sm text-slate-700">
                  Domyslny czas obslugi [min]
                  <input
                    name="domyslny_czas_obslugi_min"
                    type="number"
                    min="1"
                    step="1"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
                    value={form.domyslny_czas_obslugi_min}
                    onChange={handleFieldChange}
                  />
                </label>

                <label className="text-sm text-slate-700">
                  Szerokosc okna czasowego [min]
                  <input
                    name="szerokosc_okna_min"
                    type="number"
                    min="1"
                    step="1"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
                    value={form.szerokosc_okna_min}
                    onChange={handleFieldChange}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">SMS dla klienta</h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    Szablony sa zapisywane bez polskich znakow. Dostepne
                    placeholdery: <code>{"{{okno}}"}</code>,{" "}
                    <code>{"{{link}}"}</code>, <code>{"{{telefon}}"}</code>.
                  </p>
                </div>
                <div className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                  ASCII only
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <label className="text-sm text-slate-700">
                  Telefon kontaktowy dla klienta
                  <input
                    name="sms_kontakt_telefon"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
                    value={form.sms_kontakt_telefon}
                    onChange={handleFieldChange}
                    placeholder="+48 123 456 789"
                  />
                  <div className="mt-2 text-xs text-slate-500">
                    Na ten numer zadzwoni klient po kliknieciu przycisku
                    kontaktu na stronie potwierdzenia.
                  </div>
                </label>

                <label className="text-sm text-slate-700">
                  Szablon SMS potwierdzenia terminu
                  <textarea
                    name="sms_szablon_potwierdzenia"
                    className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
                    value={form.sms_szablon_potwierdzenia}
                    onChange={handleFieldChange}
                  />
                </label>

                <label className="text-sm text-slate-700">
                  Szablon SMS startu trasy
                  <textarea
                    name="sms_szablon_startu_trasy"
                    className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-sky-500"
                    value={form.sms_szablon_startu_trasy}
                    onChange={handleFieldChange}
                  />
                </label>
              </div>
            </section>

            {saveError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {saveError}
              </div>
            ) : null}

            {saveSuccess ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {saveSuccess}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving || !isDirty}
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Zapisywanie..." : "Zapisz ustawienia"}
              </button>
              <button
                type="button"
                disabled={saving || !isDirty}
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleReset}
              >
                Cofnij zmiany
              </button>
            </div>
          </form>

          <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
              <h2 className="text-xl font-semibold">Podglad wpisu</h2>
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <div>ID: {savedSettings.id}</div>
                <div>Adres bazy: {savedSettings.adres_bazy}</div>
                <div>
                  Wspolrzedne: {savedSettings.lat}, {savedSettings.lon}
                </div>
                <div>
                  Domyslny czas obslugi:{" "}
                  {savedSettings.domyslny_czas_obslugi_min} min
                </div>
                <div>
                  Szerokosc okna: {savedSettings.szerokosc_okna_min} min
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
              <h2 className="text-xl font-semibold">Podglad SMS</h2>
              <div className="mt-5 space-y-4">
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Potwierdzenie ETA
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {confirmationPreview}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Start trasy
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {routeStartPreview}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
              <h2 className="text-xl font-semibold">Metadane</h2>
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <div>Utworzono: {formatDate(savedSettings.created_at, true)}</div>
                <div>Zaktualizowano: {formatDate(savedSettings.updated_at, true)}</div>
                <div>Status: {savedSettings.aktywny ? "aktywny" : "nieaktywny"}</div>
                <div>
                  Telefon kontaktowy:{" "}
                  {savedSettings.sms_kontakt_telefon || normalizedContactPhone || "-"}
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
              <h2 className="text-xl font-semibold">Wplyw na trasy</h2>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Te wartosci sa uzywane przy wyliczaniu punktu startowego,
                powrotu do bazy, lampki SMS oraz tresci wiadomosci wysylanych
                klientowi.
              </p>
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}

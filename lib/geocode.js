// /lib/geocode.js
export async function geocodeAddress(addressRaw, opts = {}) {
  const { miejscowosc = "", kod = "", ulica = "" } = opts;

  const normalizeAddress = (addr) => {
    const map = {
      "gen\\.": "Generała",
      "dr\\.": "Doktora",
      "ks\\.": "Księdza",
      "św\\.": "Świętego",
      "prof\\.": "Profesora",
    };
    Object.entries(map).forEach(([abbr, full]) => {
      const rx = new RegExp(`(^|\\s)${abbr}(?=\\s)`, "gi");
      addr = addr.replace(rx, `$1${full}`);
    });
    return addr
      .replace(/\bul\.?(?=\s|$)(?!ica)/gi, "ulica")
      .replace(/\blok\.?/gi, "lokal")
      .replace(/\bm(\d+)\b/gi, "/$1")
      .replace(/\s+/g, " ")
      .trim();
  };

  // 👇 helpers do porównań nazw ulic i numerów
  const stripDiacritics = (s) =>
    (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normRoad = (s) =>
    stripDiacritics(s)
      .toLowerCase()
      .replace(/\bulica\b|\bul\.\b/g, "")
      .replace(/[.,]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const extractNumber = (s) => {
    const m = (s || "").match(/\b(\d+[a-zA-Z]?([/-]\d+[a-zA-Z]?)?)\b/);
    return m ? m[1].toLowerCase() : "";
  };

  const cleaned = normalizeAddress(addressRaw);
  const apiKey = process.env.NEXT_PUBLIC_OPENCAGE_API_KEY;
  if (!apiKey) {
    console.error("❌ Brak NEXT_PUBLIC_OPENCAGE_API_KEY");
    return null;
  }

  const BOUNDS_PL = "14.07,49.00,24.15,54.90";
  const IN_PL = ({ lat, lon }) =>
    lat >= 48.5 && lat <= 55.2 && lon >= 13.5 && lon <= 24.5;
  const fixIfSwapped = ({ lat, lon }) =>
    lat < 30 && lon > 30 ? { lat: lon, lon: lat } : { lat, lon };

  const fetchOC = async (q) => {
    const params = new URLSearchParams({
      q: `${q}, Polska`,
      key: apiKey,
      language: "pl",
      countrycode: "pl",
      bounds: BOUNDS_PL,
      no_annotations: "1",
      address_only: "1",
      limit: "5",
      roadinfo: "1", // 👈 prosimy o dopasowanie do najbliższej drogi
    });
    const res = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?${params.toString()}`
    );
    if (!res.ok) throw new Error(`OpenCage ${res.status}`);
    return res.json();
  };

  // wartości referencyjne do dopasowania
  const refStreet = normRoad(ulica || cleaned);
  const refNumber = extractNumber(ulica || cleaned);

  const scoreStrict = (r) => {
    let s = 0;
    const road = normRoad(r?.components?.road);
    const hn = (r?.components?.house_number || "").toLowerCase();
    const pc = (r?.components?.postcode || "").replace(/\s/g, "").toLowerCase();
    const conf = r?.confidence ?? 0;

    // kod/miejscowość ważne, ale ulica/numer najważniejsze
    if (kod) {
      if (pc === kod.replace(/\s/g, "").toLowerCase()) s += 3;
      else s -= 10; // Duża kara za zły kod pocztowy
    }

    // dopasowanie miasta/town/village
    const city = (
      r?.components?.city ||
      r?.components?.town ||
      r?.components?.village ||
      r?.components?.municipality ||
      ""
    ).toLowerCase();
    if (miejscowosc) {
      if (city === miejscowosc.toLowerCase()) s += 3;
      else s -= 10; // Duża kara za złe miasto
    }

    // 🔥 ulica: pełne lub częściowe dopasowanie, brak ulicy = kara
    if (refStreet) {
      if (
        road &&
        (road === refStreet ||
          road.includes(refStreet) ||
          refStreet.includes(road))
      )
        s += 6;
      else s -= 4;
    } else if (road) {
      s += 1;
    }

    // 🔥 numer domu (prefiks wystarczy: "7" dopasuje "7/4")
    if (refNumber) {
      if (hn && (hn === refNumber || hn.startsWith(refNumber))) s += 4;
      else s -= 2;
    }

    // confidence jako delikatny tie-breaker
    s += conf / 10;
    return s;
  };

  const scoreSoft = (r) => {
    let s = 0;
    const pc = (r?.components?.postcode || "").replace(/\s/g, "").toLowerCase();
    const conf = r?.confidence ?? 0;

    if (kod && pc === kod.replace(/\s/g, "").toLowerCase()) s += 3;

    const city = (
      r?.components?.city ||
      r?.components?.town ||
      r?.components?.village ||
      r?.components?.municipality ||
      ""
    ).toLowerCase();
    if (miejscowosc && city === miejscowosc.toLowerCase()) s += 3;

    s += conf / 10;
    return s;
  };

  const pickBest = (results, scoreFn) => {
    if (!results?.length) return null;
    const sorted = results.slice().sort((a, b) => scoreFn(b) - scoreFn(a));

    // Przy rygorystycznym sprawdzaniu odrzuć wyniki z ujemnym wynikiem.
    if (scoreFn === scoreStrict && scoreFn(sorted[0]) < 0) {
      return null;
    }

    const { lat, lng } = sorted[0].geometry;
    return fixIfSwapped({ lat, lon: lng });
  };

  try {
    // 1) pełny adres z podziałem na części (rygorystyczne dopasowanie)
    const fullAddress = [ulica, miejscowosc, kod].filter(Boolean).join(", ");
    let data = await fetchOC(fullAddress);
    let best = pickBest(data.results, scoreStrict);
    if (best && IN_PL(best)) return best;

    // 2) miasto + kod (łagodniejsze dopasowanie)
    const base = [miejscowosc, kod].filter(Boolean).join(", ");
    if (base.length > 3) {
      data = await fetchOC(base);
      best = pickBest(data.results, scoreSoft);
      if (best && IN_PL(best)) return best;
    }

    // 3) sam kod pocztowy (łagodniejsze dopasowanie)
    if (kod) {
      data = await fetchOC(kod);
      best = pickBest(data.results, scoreSoft);
      if (best && IN_PL(best)) return best;
    }

    // 4) samo miasto (łagodniejsze dopasowanie)
    if (miejscowosc) {
      data = await fetchOC(miejscowosc);
      best = pickBest(data.results, scoreSoft);
      if (best && IN_PL(best)) return best;
    }

    console.warn("⚠️ Geokodowanie nieudane:", cleaned);
    return null;
  } catch (e) {
    console.error("❌ Błąd geokodowania:", e.message);
    return null;
  }
}

// /lib/geocode.js
export async function geocodeAddress(addressRaw, opts = {}) {
  const { miejscowosc = "", kod = "" } = opts;

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
      .replace(/\bul\.?(?=\s|$)(?!ica)/gi, "ulica") // nie robi "ulicaICA"
      .replace(/\blok\.?/gi, "lokal")
      .replace(/\bm(\d+)\b/gi, "/$1")
      .replace(/\s+/g, " ")
      .trim();
  };

  const cleaned = normalizeAddress(addressRaw);
  const apiKey = process.env.NEXT_PUBLIC_OPENCAGE_API_KEY;
  if (!apiKey) {
    console.error("❌ Brak NEXT_PUBLIC_OPENCAGE_API_KEY");
    return null;
  }

  // granice PL – proste odcięcie błędów
  const IN_PL = ({ lat, lon }) =>
    lat >= 48.5 && lat <= 55.0 && lon >= 14.0 && lon <= 24.5;

  const fixIfSwapped = ({ lat, lon }) => {
    // jeżeli wygląda jak zamiana miejscami – odwróć
    if (lat < 30 && lon > 30) return { lat: lon, lon: lat };
    return { lat, lon };
  };

  const fetchOC = async (q) => {
    const url =
      `https://api.opencagedata.com/geocode/v1/json?` +
      `q=${encodeURIComponent(q + ", Polska")}` +
      `&key=${apiKey}&language=pl&countrycode=pl&no_annotations=1&limit=5`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OpenCage ${res.status}`);
    return res.json();
  };

  const tryPick = (results) => {
    if (!results || !results.length) return null;

    // 1) filtr po kodzie pocztowym jeśli mamy
    let arr = results;
    if (kod) {
      const k = kod.replace(/\s/g, "").toLowerCase();
      const withPost = results.filter((r) => {
        const pc = (r.components.postcode || "")
          .replace(/\s/g, "")
          .toLowerCase();
        return pc === k;
      });
      if (withPost.length) arr = withPost;
    }

    // 2) dopasowanie miasta/miejscowości
    if (miejscowosc) {
      const m = miejscowosc.toLowerCase();
      const cityFields = (r) =>
        (
          r.components.city ||
          r.components.town ||
          r.components.village ||
          r.components.municipality ||
          ""
        ).toLowerCase();

      const exact = arr.filter((r) => cityFields(r) === m);
      if (exact.length) arr = exact;
      else {
        const loose = arr.filter((r) => cityFields(r).includes(m));
        if (loose.length) arr = loose;
      }
    }

    // 3) wybierz najbardziej „drogowy”/adresowy rezultat
    arr.sort((a, b) => {
      const ra = a.components.road ? 1 : 0;
      const rb = b.components.road ? 1 : 0;
      return rb - ra;
    });

    const { lat, lng } = arr[0].geometry;
    return fixIfSwapped({ lat, lon: lng });
  };

  try {
    // próba 1: pełny adres
    const data1 = await fetchOC(cleaned);
    let picked = tryPick(data1.results);
    if (picked && IN_PL(picked)) return picked;

    // próba 2: bez ulicy (miasto + kod)
    const base = `${miejscowosc}, ${kod}`.trim();
    if (base.length > 3) {
      const data2 = await fetchOC(base);
      picked = tryPick(data2.results);
      if (picked && IN_PL(picked)) return picked;
    }

    // próba 3: samo miasto
    if (miejscowosc) {
      const data3 = await fetchOC(miejscowosc);
      picked = tryPick(data3.results);
      if (picked && IN_PL(picked)) return picked;
    }

    console.warn("⚠️ Geokodowanie nieudane:", cleaned);
    return null;
  } catch (e) {
    console.error("❌ Błąd geokodowania:", e.message);
    return null;
  }
}

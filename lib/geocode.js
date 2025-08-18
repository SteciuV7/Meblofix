export async function geocodeAddress(addressRaw) {
  const normalizeAddress = (addr) => {
    const abbreviationMap = {
      "gen\\.": "Generała",
      "dr\\.": "Doktora",
      "ks\\.": "Księdza",
      "św\\.": "Świętego",
      "prof\\.": "Profesora",
    };

    // Zamiana tylko samodzielnych skrótów, NIE fragmentów wyrazów (np. nie "Książąt")
    Object.entries(abbreviationMap).forEach(([abbr, full]) => {
      const regex = new RegExp(`(^|\\s)${abbr}(?=\\s)`, "gi");
      addr = addr.replace(regex, `$1${full}`);
    });

    return addr
      .replace(/\bul\.?(?=\s|$)(?!ica)/gi, "ulica")
      .replace(/\blok\.?/gi, "lokal")
      .replace(/\bm(\d+)\b/gi, "/$1")
      .replace(/\s+/g, " ")
      .trim();
  };

  const cleanedAddress = normalizeAddress(addressRaw);

  console.log("✍️ Adres przed:", addressRaw);
  console.log("✅ Adres po czyszczeniu:", cleanedAddress);

  const apiKey = process.env.NEXT_PUBLIC_OPENCAGE_API_KEY;
  if (!apiKey) {
    console.error(
      "❌ Brak klucza API. Upewnij się, że jest ustawiony w Vercel."
    );
    return null;
  }

  try {
    const res = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
        cleanedAddress
      )}&key=${apiKey}&language=pl&countrycode=pl`
    );
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry;
      return { lat, lon: lng };
    } else {
      console.warn("⚠️ Nie znaleziono adresu:", cleanedAddress);
      return null;
    }
  } catch (err) {
    console.error("❌ Błąd geokodowania:", err);
    return null;
  }
}

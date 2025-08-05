export async function geocodeAddress(addressRaw) {
  const normalizeAddress = (addr) => {
    const abbreviationMap = {
      "gen.": "Generała",
      gen: "Generała",
      "dr.": "Doktora",
      dr: "Doktora",
      "ks.": "Księdza",
      ks: "Księdza",
      "św.": "Świętego",
      św: "Świętego",
      "prof.": "Profesora",
      prof: "Profesora",
    };

    // Zamień skróty w adresie
    Object.entries(abbreviationMap).forEach(([abbr, full]) => {
      const regex = new RegExp(`\\b${abbr}\\b`, "gi");
      addr = addr.replace(regex, full);
    });

    // Dodatkowe czyszczenie
    return addr
      .replace(/\bul\.?\s*/gi, "") // usuń "ul.", "ul ", "UL."
      .replace(/\blok\.?\s*/gi, "") // usuń "lok", "lok.", "lok "
      .replace(/\bm(\d+)\b/gi, "/$1") // zamień "m36" → "/36"
      .replace(/\s+/g, " ") // nadmiarowe spacje
      .trim(); // usuń spacje z końca i początku
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

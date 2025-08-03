export async function geocodeAddress(address) {
  console.log("➡️ Geokoduję:", address);
  const apiKey = process.env.NEXT_PUBLIC_OPENCAGE_API_KEY;
  try {
    const res = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
        address
      )}&key=${apiKey}&language=pl&countrycode=pl`
    );
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry;
      return { lat, lon: lng };
    } else {
      console.warn("⚠️ Nie znaleziono adresu:", address);
      return null;
    }
  } catch (err) {
    console.error("❌ Błąd geokodowania:", err);
    return null;
  }
}

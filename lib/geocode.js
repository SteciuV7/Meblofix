// /lib/geocode.js
export async function geocodeAddress(address) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("❌ Brak NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
    return null;
  }

  const params = new URLSearchParams({
    address: address,
    key: apiKey,
    language: "pl",
    region: "PL",
    components: "country:PL",
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    );

    if (!res.ok) {
      throw new Error(`Google Geocoding API ${res.status}`);
    }

    const data = await res.json();

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.warn(
        "⚠️ Geokodowanie nieudane:",
        address,
        "Status:",
        data.status
      );
      return null;
    }

    const result = data.results[0];
    const { location } = result.geometry;

    // Podstawowa weryfikacja jakości wyniku
    const isGoodResult =
      result.geometry.location_type === "ROOFTOP" ||
      result.geometry.location_type === "RANGE_INTERPOLATED" ||
      (result.types.includes("street_address") &&
        result.address_components.some((c) =>
          c.types.includes("street_number")
        ));

    if (!isGoodResult) {
      console.warn(
        "⚠️ Geokodowanie dało przybliżony wynik dla:",
        address,
        "Typ:",
        result.geometry.location_type
      );
      // Można zdecydować o odrzuceniu przybliżonych wyników, zwracając null
      // return null;
    }

    return { lat: location.lat, lon: location.lng };
  } catch (e) {
    console.error("❌ Błąd geokodowania:", e.message);
    return null;
  }
}

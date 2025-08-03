import dynamic from "next/dynamic";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/router";
import { FiLogOut } from "react-icons/fi";
import Image from "next/image";
import { useEffect, useState, useCallback } from "react";

// Dynamiczne komponenty Leaflet
const MapWithNoSSR = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});

export default function Mapa() {
  const [user, setUser] = useState(null);
  const [points, setPoints] = useState([]);
  const [defaultIcon, setDefaultIcon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedReklamacja, setSelectedReklamacja] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();
  const [statystyki, setStatystyki] = useState({
    zapisane: 0,
    przetworzone: 0,
    bledy: 0,
  });

  const [showPopup, setShowPopup] = useState(false);

  const getColorIcon = (status) => {
    if (typeof window === "undefined") return null;

    const colorMap = {
      Zgłoszone: "yellow",
      Zaktualizowano: "orange",
      "Oczekuje na informacje": "red",
      "Oczekuje na dostawę": "violet",
      "W trakcie realizacji": "blue",
    };

    const color = colorMap[status] || "blue";

    const L = require("leaflet");

    return new L.Icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png",
      shadowSize: [41, 41],
    });
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser(user);
    });
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      import("leaflet").then((L) => {
        const icon = new L.Icon({
          iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        });
        setDefaultIcon(icon);
        console.log("✅ Ikona ustawiona");
      });
    }
  }, []);

  async function geocodeAddress(address) {
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

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("reklamacje")
        .select(
          "id, nazwa_firmy, numer_faktury, kod_pocztowy, miejscowosc, adres, opis, pozostaly_czas, realizacja_do, informacje, informacje_od_zglaszajacego, zalacznik_pdf, zalacznik_zdjecia, zalacznik_pdf_zakonczenie, zalacznik_zakonczenie, opis_przebiegu, nieprzeczytane_dla_uzytkownika, status, trasa, lat, lon"
        )
        .not("status", "in", '("Zakończone","Archiwum")');

      if (error) throw error;
      console.log("📦 Reklamacje:", data);

      const pointsWithCoords = [];

      let zapisane = 0;
      let przetworzone = 0;
      let bledy = 0;

      for (const rek of data) {
        const fullAddress = `${rek.miejscowosc}, ${rek.kod_pocztowy} ${rek.adres}`;

        if (rek.lat && rek.lon) {
          zapisane++;
          pointsWithCoords.push({ ...rek, adres: fullAddress });
          continue;
        }

        const coords = await geocodeAddress(fullAddress);

        if (coords) {
          przetworzone++;

          await supabase
            .from("reklamacje")
            .update({ lat: coords.lat, lon: coords.lon })
            .eq("id", rek.id);

          pointsWithCoords.push({
            ...rek,
            lat: coords.lat,
            lon: coords.lon,
            adres: fullAddress,
          });
        } else {
          bledy++;
        }
      }

      setPoints(pointsWithCoords);
      setStatystyki({ zapisane, przetworzone, bledy });
      setShowPopup(true); // pokaż popup po zakończeniu
    } catch (error) {
      console.error("❌ Błąd Supabase:", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-gray-900 text-white py-5 px-8 flex justify-between items-center shadow-lg">
        <h1
          className="text-2xl font-bold cursor-pointer hover:text-gray-300 transition"
          onClick={() => router.push("/dashboard")}
        >
          Meblofix Sp. z o.o.
        </h1>
        <div className="relative">
          <div className="flex items-center space-x-4">
            {user && <span className="text-sm font-medium">{user.email}</span>}
            <button
              className="bg-red-500 text-white w-10 h-10 rounded-full flex items-center justify-center"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              {user?.email?.charAt(0).toUpperCase()}
            </button>
          </div>
          {dropdownOpen && (
            <div className="absolute right-0 mt-3 w-48 bg-white rounded-lg shadow-lg border p-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                <FiLogOut className="mr-2" /> Wyloguj się
              </button>
            </div>
          )}
        </div>
      </header>

      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96 text-center">
            <h3 className="text-xl font-semibold mb-4">
              Podsumowanie geokodowania
            </h3>
            <p className="mb-2">✅ Zapisane: {statystyki.zapisane}</p>
            <p className="mb-2">🔄 Przetworzone: {statystyki.przetworzone}</p>
            <p className="mb-2">❌ Błędy: {statystyki.bledy}</p>
            <button
              className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
              onClick={() => setShowPopup(false)}
            >
              Zamknij
            </button>
          </div>
        </div>
      )}

      <div className="p-6">
        <h2 className="text-3xl font-bold mb-6 text-center">Mapa reklamacji</h2>

        {loading && <p className="text-center">Ładowanie mapy...</p>}

        {!loading && points.length === 0 && (
          <p className="text-center">Brak reklamacji do wyświetlenia.</p>
        )}

        {!showPopup && points.length > 0 && (
          <MapWithNoSSR
            center={[52.2297, 21.0122]}
            zoom={6}
            style={{ height: "80vh", width: "100%", zIndex: 0 }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {points.map((point, idx) => (
              <Marker
                key={idx}
                position={[point.lat, point.lon]}
                icon={getColorIcon(point.status)}
              >
                <Popup>
                  <div className="text-sm space-y-1">
                    <p>
                      <strong>Firma:</strong> {point.nazwa_firmy}
                    </p>
                    <p>
                      <strong>Status:</strong> {point.status}
                    </p>
                    <p>
                      <strong>Adres:</strong> {point.adres}
                    </p>
                    <p>
                      <strong>Termin realizacji:</strong>{" "}
                      {point.realizacja_do?.split("T")[0]}
                    </p>
                    <p>
                      <strong>Numer reklamacji:</strong> {point.numer_faktury}
                    </p>
                    <p>
                      <strong>Opis:</strong> {point.opis}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
                        onClick={() => {
                          setSelectedReklamacja(point);
                          setIsPreviewOpen(true);
                        }}
                      >
                        Podgląd
                      </button>
                      <button
                        onClick={() =>
                          window.open(
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              point.adres
                            )}`,
                            "_blank"
                          )
                        }
                        className="bg-gray-700 text-white px-3 py-1 rounded text-xs hover:bg-gray-800 transition"
                      >
                        Nawiguj
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapWithNoSSR>
        )}
        {isPreviewOpen && selectedReklamacja && (
          <div
            className="fixed inset-0 flex justify-center items-center z-50 modal-preview overflow-y-auto"
            style={{ background: "rgba(0, 0, 0, 0.4)" }}
          >
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-4xl mx-4 relative">
              <h3 className="text-xl font-semibold mb-4">Podgląd reklamacji</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p>
                    <strong>Nazwa firmy:</strong>{" "}
                    {selectedReklamacja.nazwa_firmy}
                  </p>
                  <p>
                    <strong>Numer reklamacji:</strong>{" "}
                    {selectedReklamacja.numer_faktury}
                  </p>
                  <p>
                    <strong>Kod pocztowy:</strong>{" "}
                    {selectedReklamacja.kod_pocztowy}
                  </p>
                  <p>
                    <strong>Miejscowość:</strong>{" "}
                    {selectedReklamacja.miejscowosc}
                  </p>
                  <p>
                    <strong>Adres:</strong> {selectedReklamacja.adres}
                  </p>
                  <p className="break-words whitespace-pre-wrap">
                    <strong>Opis:</strong> {selectedReklamacja.opis}
                  </p>
                  <p>
                    <strong>Termin realizacji:</strong>{" "}
                    {new Date(
                      selectedReklamacja.realizacja_do
                    ).toLocaleDateString()}
                  </p>
                  <p>
                    <strong>Pozostały czas:</strong>{" "}
                    {selectedReklamacja.pozostaly_czas} dni
                  </p>
                  <p>
                    <strong>Informacje od zgłaszającego:</strong>{" "}
                    {selectedReklamacja.informacje_od_zglaszajacego}
                  </p>
                  <p className="break-words whitespace-pre-wrap">
                    <strong>Informacje od Meblofix:</strong>{" "}
                    {selectedReklamacja.informacje}
                  </p>
                </div>
                <div>
                  {selectedReklamacja.zalacznik_pdf && (
                    <>
                      <p>
                        <strong>Załącznik PDF:</strong>
                      </p>
                      <a
                        href={`https://dpqfpqxgzpkhpulbiype.supabase.co/storage/v1/object/public/reklamacje/${selectedReklamacja.zalacznik_pdf}`}
                        target="_blank"
                        className="text-blue-500 underline"
                      >
                        Otwórz PDF
                      </a>
                    </>
                  )}

                  {selectedReklamacja.zalacznik_zdjecia?.length > 0 && (
                    <>
                      <p className="mt-4">
                        <strong>Załączniki zdjęciowe:</strong>
                      </p>
                      <div className="flex overflow-x-auto space-x-2 mt-1 w-full max-w-full">
                        {selectedReklamacja.zalacznik_zdjecia.map(
                          (img, index) => (
                            <Image
                              key={index}
                              src={`https://dpqfpqxgzpkhpulbiype.supabase.co/storage/v1/object/public/reklamacje/${img}`}
                              alt="Załącznik"
                              width={80}
                              height={80}
                              className="h-20 w-20 object-cover rounded flex-shrink-0"
                              unoptimized
                            />
                          )
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <button
                  className="bg-red-500 text-white px-4 py-2 rounded"
                  onClick={async () => {
                    setIsPreviewOpen(false);
                    setSelectedReklamacja(null);
                  }}
                >
                  Zamknij
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

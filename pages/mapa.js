import dynamic from "next/dynamic";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/router";
import { FiLogOut } from "react-icons/fi";
import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { geocodeAddress } from "../lib/geocode";
import { APP_VERSION } from "../lib/version";

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
// Dodaj import dynamiczny MarkerClusterGroup
const MarkerClusterGroup = dynamic(
  () => import("react-leaflet-markercluster"),
  { ssr: false }
);

// Funkcja dodająca przesunięcie tylko dla duplikatów współrzędnych
function spreadMarkers(points) {
  const used = new Map(); // mapa: "lat,lon" -> licznik

  return points.map((p) => {
    const key = `${p.lat},${p.lon}`;
    let count = used.get(key) || 0;
    used.set(key, count + 1);

    if (count === 0) {
      // pierwszy punkt w tym miejscu – bez przesunięcia
      return p;
    }

    // kolejne punkty w tym samym miejscu – dostają przesunięcie
    const offset = 0.002 * count; // ~200m na każdy dodatkowy punkt
    return {
      ...p,
      lat: p.lat + offset,
      lon: p.lon + offset,
    };
  });
}

export default function Mapa() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(""); // Dodaj role
  const [userFirmaId, setUserFirmaId] = useState(null); // Dodaj firma_id
  const [points, setPoints] = useState([]);
  const [allPoints, setAllPoints] = useState([]); // Wszystkie punkty
  const [producenci, setProducenci] = useState([]);
  const [selectedProducent, setSelectedProducent] = useState("");
  const isPointInRoute = (point) => routePoints.some((p) => p.id === point.id);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [defaultIcon, setDefaultIcon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedReklamacja, setSelectedReklamacja] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();
  const [routeMode, setRouteMode] = useState(false); // tryb zaznaczania punktów
  const [routePoints, setRoutePoints] = useState([]); // punkty wybrane do trasy
  const [statystyki, setStatystyki] = useState({
    zapisane: 0,
    przetworzone: 0,
    bledy: 0,
  });

  const [showPopup, setShowPopup] = useState(false);
  const [clusterEnabled, setClusterEnabled] = useState(false); // przełącznik klastrów

  const getColorIcon = (status) => {
    if (typeof window === "undefined") return null;

    const colorMap = {
      Zgłoszone: "red",
      Zaktualizowano: "orange",
      "Oczekuje na informacje": "black",
      "Oczekuje na dostawę": "violet",
      "W trakcie realizacji": "green",
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
    // Pobierz użytkownika i jego dane z firmy
    async function fetchUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (user) {
        const { data: userData, error: userError } = await supabase
          .from("firmy")
          .select("*")
          .eq("email", user.email)
          .single();
        if (!userError && userData) {
          setUser(user);
          setUserRole(userData.rola);
          setUserFirmaId(userData.firma_id);
        }
      }
    }
    fetchUser();
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

  // w mapa.js – PODMIANKA funkcji 1:1 (zostaje ta sama sygnatura)

  const fetchData = useCallback(async () => {
    try {
      let data, error;
      if (userRole === "admin") {
        // Admin widzi wszystkie reklamacje
        ({ data, error } = await supabase
          .from("reklamacje")
          .select(
            "id, nazwa_firmy, numer_faktury, kod_pocztowy, miejscowosc, adres, opis, pozostaly_czas, realizacja_do, informacje, informacje_od_zglaszajacego, zalacznik_pdf, zalacznik_zdjecia, zalacznik_pdf_zakonczenie, zalacznik_zakonczenie, opis_przebiegu, nieprzeczytane_dla_uzytkownika, status, trasa, lat, lon"
          )
          .not("status", "in", '("Zakończone","Archiwum")'));
      } else if (userFirmaId) {
        // Użytkownik widzi tylko swoje reklamacje
        ({ data, error } = await supabase
          .from("reklamacje")
          .select(
            "id, nazwa_firmy, numer_faktury, kod_pocztowy, miejscowosc, adres, opis, pozostaly_czas, realizacja_do, informacje, informacje_od_zglaszajacego, zalacznik_pdf, zalacznik_zdjecia, zalacznik_pdf_zakonczenie, zalacznik_zakonczenie, opis_przebiegu, nieprzeczytane_dla_uzytkownika, status, trasa, lat, lon"
          )
          .eq("firma_id", userFirmaId)
          .not("status", "in", '("Zakończone","Archiwum")'));
      } else {
        setLoading(false);
        return;
      }

      if (error) throw error;
      console.log("📦 Reklamacje:", data);

      const pointsWithCoords = [];
      let zapisane = 0;
      let przetworzone = 0;
      let bledy = 0;

      // ⚠️ kolejno, żeby nie wyjechać poza limity API
      for (const rek of data) {
        // standardowa kolejność: "Ulica nr, Miasto, Kod"
        const fullAddress = `${rek.adres}, ${rek.miejscowosc}, ${rek.kod_pocztowy}`;

        // 1) sentinel 52/20 traktuj jako błąd – nie dodawaj na mapę
        if (rek.lat === 52 && rek.lon === 20) {
          bledy++;
          continue;
        }

        // 2) jeżeli ma już współrzędne – użyj i leć dalej
        if (rek.lat != null && rek.lon != null) {
          zapisane++;
          pointsWithCoords.push({ ...rek, adres: fullAddress });
          continue;
        }

        // 3) geokoduj brakujące – PRZEKAZUJEMY CAŁY ADRES
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
          // jawnie wyczyść, żeby nie został żaden placeholder
          await supabase
            .from("reklamacje")
            .update({ lat: null, lon: null })
            .eq("id", rek.id);
        }

        // (opcjonalnie) jeżeli masz darmowy klucz OC (1 req/s), odkomentuj:
        // await new Promise(r => setTimeout(r, 1100));
      }

      // 4) globalny cleanup 52/20
      await supabase
        .from("reklamacje")
        .update({ lat: null, lon: null })
        .eq("lat", 52)
        .eq("lon", 20);

      const uniqueProducenci = [
        ...new Set(data.map((item) => item.nazwa_firmy)),
      ].sort();
      setProducenci(uniqueProducenci);

      setAllPoints(pointsWithCoords);
      setPoints(spreadMarkers(pointsWithCoords));
      setStatystyki({ zapisane, przetworzone, bledy });
      setShowPopup(true);
    } catch (error) {
      console.error("❌ Błąd Supabase:", error.message);
    } finally {
      setLoading(false);
    }
  }, [userRole, userFirmaId]);

  useEffect(() => {
    if (userRole) fetchData();
  }, [fetchData, userRole]);

  const handleFilter = () => {
    if (selectedProducent) {
      const filtered = allPoints.filter(
        (p) => p.nazwa_firmy === selectedProducent
      );
      setPoints(spreadMarkers(filtered));
    }
  };

  const clearFilter = () => {
    setSelectedProducent("");
    setPoints(spreadMarkers(allPoints));
  };

  // Funkcja do generowania własnego wyglądu klastra
  function getClusterColor(count) {
    if (count < 10) return "#4ade80"; // zielony
    if (count < 20) return "#facc15"; // żółty
    if (count < 50) return "#f97316"; // pomarańczowy
    return "#ef4444"; // czerwony
  }

  function createClusterCustomIcon(cluster) {
    const count = cluster.getChildCount();
    const color = getClusterColor(count);
    // Kwadratowy div z liczbą
    return window.L.divIcon({
      html: `<div class="custom-cluster" style="background:${color}">${count}</div>`,
      className: "custom-cluster-wrapper",
      iconSize: [40, 40],
    });
  }

  // Dodaj funkcję handleLogout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-gray-900 text-white py-5 px-8 flex justify-between items-center shadow-lg">
        <h1
          className="text-2xl font-bold cursor-pointer hover:text-gray-300 transition flex items-baseline space-x-2"
          onClick={() => router.push("/dashboard")}
        >
          <span>Meblofix Sp. z o.o.</span>
          <span className="text-sm text-gray-400 font-normal">
            Ver. {APP_VERSION}
          </span>
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
        {/* Przycisk trybu trasy i filtry tylko dla admina */}
        {userRole === "admin" && (
          <div className="flex justify-between items-center mb-4">
            <button
              className={`px-4 py-2 rounded text-white ${
                routeMode ? "bg-yellow-600" : "bg-gray-800"
              } hover:bg-yellow-700`}
              onClick={() => {
                setRouteMode(!routeMode);
                if (routeMode) {
                  setRoutePoints([]);
                  setShowRoutePanel(false);
                }
              }}
            >
              {routeMode ? "Zakończ tryb trasy" : "Tryb trasy"}
            </button>
            {/* --- PRZEŁĄCZNIK KLASTRÓW tylko dla admina --- */}
            <div className="flex flex-col items-center">
              <label className="flex items-center cursor-pointer select-none">
                <span className="mr-2 font-medium text-gray-700">
                  Grupowanie
                </span>
                <span className="relative">
                  <input
                    type="checkbox"
                    checked={clusterEnabled}
                    onChange={() => setClusterEnabled((v) => !v)}
                    className="sr-only"
                  />
                  <span
                    className={`block w-10 h-6 rounded-full transition ${
                      clusterEnabled ? "bg-green-500" : "bg-gray-400"
                    }`}
                  ></span>
                  <span
                    className={`dot absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition ${
                      clusterEnabled ? "translate-x-4" : ""
                    }`}
                    style={{
                      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                      transition: "transform 0.2s",
                    }}
                  ></span>
                </span>
              </label>
            </div>
            {/* --- KONIEC PRZEŁĄCZNIKA --- */}
            <div className="flex items-center gap-2">
              <select
                value={selectedProducent}
                onChange={(e) => setSelectedProducent(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Wszyscy producenci</option>
                {producenci.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <button
                onClick={handleFilter}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Filtruj
              </button>
              <button
                onClick={clearFilter}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Wyczyść
              </button>
            </div>
            {routeMode && (
              <button
                className="bg-indigo-700 text-white px-4 py-2 rounded hover:bg-indigo-800"
                onClick={() => setShowRoutePanel((prev) => !prev)}
              >
                🧭 Trasa ({routePoints.length})
              </button>
            )}
          </div>
        )}
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

            {/* --- Markery w klastrze lub bez --- */}
            {clusterEnabled ? (
              <MarkerClusterGroup
                iconCreateFunction={createClusterCustomIcon}
                disableClusteringAtZoom={10}
              >
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
                        <p className="flex items-center gap-2">
                          <strong>Adres:</strong> {point.adres}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(point.adres);
                              alert("Adres skopiowany do schowka!");
                            }}
                            className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-200 transition"
                            title="Skopiuj adres"
                          >
                            Kopiuj
                          </button>
                        </p>
                        <p>
                          <strong>Termin realizacji:</strong>{" "}
                          {point.realizacja_do?.split("T")[0]}
                        </p>
                        <p>
                          <strong>Numer reklamacji:</strong>{" "}
                          {point.numer_faktury}
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
                          {/* Dodawanie do trasy tylko dla admina */}
                          {userRole === "admin" && routeMode && (
                            <button
                              className={`px-3 py-1 rounded text-xs ${
                                isPointInRoute(point)
                                  ? "bg-green-600 cursor-default"
                                  : "bg-yellow-500 hover:bg-yellow-600"
                              } text-white transition`}
                              onClick={() => {
                                if (!isPointInRoute(point)) {
                                  setRoutePoints((prev) => [...prev, point]);
                                }
                              }}
                              disabled={isPointInRoute(point)}
                            >
                              {isPointInRoute(point)
                                ? "✅ Dodano"
                                : "➕ Dodaj do trasy"}
                            </button>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            ) : (
              points.map((point, idx) => (
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
                      <p className="flex items-center gap-2">
                        <strong>Adres:</strong> {point.adres}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(point.adres);
                            alert("Adres skopiowany do schowka!");
                          }}
                          className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-200 transition"
                          title="Skopiuj adres"
                        >
                          Kopiuj
                        </button>
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
                        {/* Dodawanie do trasy tylko dla admina */}
                        {userRole === "admin" && routeMode && (
                          <button
                            className={`px-3 py-1 rounded text-xs ${
                              isPointInRoute(point)
                                ? "bg-green-600 cursor-default"
                                : "bg-yellow-500 hover:bg-yellow-600"
                            } text-white transition`}
                            onClick={() => {
                              if (!isPointInRoute(point)) {
                                setRoutePoints((prev) => [...prev, point]);
                              }
                            }}
                            disabled={isPointInRoute(point)}
                          >
                            {isPointInRoute(point)
                              ? "✅ Dodano"
                              : "➕ Dodaj do trasy"}
                          </button>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))
            )}
            {/* --- KONIEC --- */}
          </MapWithNoSSR>
        )}
        {/* Panel trasy tylko dla admina */}
        {userRole === "admin" && routeMode && showRoutePanel && (
          <div
            className="fixed inset-0 flex justify-center items-center z-50 modal-preview overflow-y-auto"
            style={{ background: "rgba(0, 0, 0, 0.4)" }}
          >
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl mx-4 relative">
              <h3 className="text-xl font-semibold mb-4">🧭 Punkty trasy</h3>

              {routePoints.length === 0 && (
                <p className="text-gray-500">Brak punktów.</p>
              )}

              <ul className="space-y-2">
                {routePoints.map((point, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between border-b pb-1"
                  >
                    <span>
                      {index + 1}. {point.nazwa_firmy} - {point.adres}
                    </span>
                    <div className="flex gap-2">
                      {index > 0 && (
                        <button
                          onClick={() => {
                            const updated = [...routePoints];
                            [updated[index - 1], updated[index]] = [
                              updated[index],
                              updated[index - 1],
                            ];
                            setRoutePoints(updated);
                          }}
                          className="flex items-center justify-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm font-semibold"
                        >
                          ⬆️ Góra
                        </button>
                      )}

                      {index < routePoints.length - 1 && (
                        <button
                          onClick={() => {
                            const updated = [...routePoints];
                            [updated[index + 1], updated[index]] = [
                              updated[index],
                              updated[index + 1],
                            ];
                            setRoutePoints(updated);
                          }}
                          className="flex items-center justify-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm font-semibold"
                        >
                          ⬇️ Dół
                        </button>
                      )}

                      <button
                        onClick={() =>
                          setRoutePoints(
                            routePoints.filter((_, i) => i !== index)
                          )
                        }
                        className="flex items-center justify-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm font-semibold"
                      >
                        X
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {routePoints.length >= 1 && (
                <a
                  href={`https://www.google.com/maps/dir/My+Location/${routePoints
                    .map((p) => encodeURIComponent(p.adres))
                    .join("/")}`}
                  target="_blank"
                  className="mt-4 inline-block bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                  rel="noopener noreferrer"
                >
                  Otwórz trasę w Google Maps
                </a>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowRoutePanel(false)}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  Zamknij
                </button>
              </div>
            </div>
          </div>
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

      <style jsx global>{`
        .custom-cluster-wrapper {
          background: transparent !important;
          border: none !important;
        }
        .custom-cluster {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          font-weight: bold;
          font-size: 1.2rem;
          color: #fff;
          border: 2px solid #fff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          transition: background 0.2s;
          user-select: none;
        }
        /* Styl switcha */
        .dot {
          position: absolute;
          top: 1px;
          left: 1px;
          transition: transform 0.2s;
        }
        input[type="checkbox"]:checked + span + .dot {
          transform: translateX(16px);
        }
      `}</style>
    </div>
  );
}

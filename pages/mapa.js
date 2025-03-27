import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { supabase } from "../lib/supabase";
import DatePicker from "react-datepicker";
import { useRouter } from "next/router";
import "react-datepicker/dist/react-datepicker.css";
import { DateRange } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import { FiLogOut } from "react-icons/fi";

// Dynamiczne ładowanie komponentów Leaflet bez SSR
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
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [points, setPoints] = useState([]);
  const [defaultIcon, setDefaultIcon] = useState(null);
  const [dateRange, setDateRange] = useState([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: "selection",
    },
  ]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    async function loadUserData() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error) throw error;

        if (user) {
          setUser(user);
        }
      } catch (error) {
        console.error("Błąd ładowania danych użytkownika:", error.message);
      }
    }

    loadUserData();
  }, []);
  useEffect(() => {
    async function loadLeaflet() {
      if (typeof window !== "undefined") {
        const L = await import("leaflet");
        const icon = new L.Icon({
          iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        });
        setDefaultIcon(icon);
      }
    }

    loadLeaflet();
  }, []);
  // Funkcja do geokodowania adresu za pomocą Nominatim
  async function geocodeAddress(address) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          address
        )}`
      );
      const data = await response.json();

      if (data.length > 0) {
        console.log(
          "Geokodowanie zakończone sukcesem dla adresu:",
          address,
          data[0]
        );
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
        };
      } else {
        console.warn("Nie znaleziono współrzędnych dla adresu:", address);
        return null;
      }
    } catch (error) {
      console.error("Błąd geokodowania adresu:", error.message);
      return null;
    }
  }
  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }
  // Funkcja do pobrania reklamacji na podstawie daty trasy
  async function fetchReklamacjeByRoute(startDate, endDate) {
    try {
      setLoading(true);
      const formattedStartDate = startDate.toLocaleDateString("en-CA");
      const formattedEndDate = endDate.toLocaleDateString("en-CA");

      const { data: reklamacje, error } = await supabase
        .from("reklamacje")
        .select("nazwa_firmy, miejscowosc, adres, opis, trasa, kod_pocztowy")
        .gte("trasa", formattedStartDate)
        .lte("trasa", formattedEndDate);

      if (error) throw error;

      // Logowanie wyników zapytania
      if (!reklamacje || reklamacje.length === 0) {
        console.warn(
          "Brak reklamacji w przedziale dat:",
          formattedStartDate,
          "-",
          formattedEndDate
        );
      } else {
        console.log(
          "Reklamacje w przedziale dat:",
          formattedStartDate,
          "-",
          formattedEndDate,
          reklamacje
        );
      }

      const mappedPoints = await Promise.all(
        reklamacje.map(async (rek) => {
          const fullAddress = `${rek.miejscowosc}, ${rek.kod_pocztowy} ${rek.adres}`;
          const coordinates = await geocodeAddress(fullAddress);

          if (coordinates) {
            return {
              lat: coordinates.lat,
              lon: coordinates.lon,
              title: rek.nazwa_firmy,
              trasa: rek.trasa,
              adres: fullAddress,
            };
          } else {
            console.warn("Nie udało się zgeokodować adresu:", fullAddress);
            return null;
          }
        })
      );

      // Filtrujemy null-e (gdy geokodowanie nie zwróciło współrzędnych)
      setPoints(mappedPoints.filter((point) => point !== null));
    } catch (error) {
      console.error("Błąd ładowania reklamacji:", error.message);
    } finally {
      setLoading(false);
    }
  }

  // Obsługa zmiany daty
  const handleDateChange = (range) => {
    setDateRange([range]);
    fetchReklamacjeByRoute(range.startDate, range.endDate);
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
      <div className="min-h-screen bg-gray-100 text-gray-900 p-4">
        <h2 className="text-3xl font-bold mb-4 text-center">Mapa reklamacji</h2>

        {/* Wybór daty trasy */}
        <div className="flex justify-center mb-6">
          <DateRange
            editableDateInputs={true}
            onChange={(ranges) => handleDateChange(ranges.selection)}
            moveRangeOnFirstSelection={false}
            ranges={dateRange}
          />
        </div>

        {loading && <p className="text-center">Ładowanie mapy...</p>}

        {/* Mapa pojawia się dopiero po wybraniu daty */}
        {points.length > 0 && defaultIcon && (
          <MapWithNoSSR
            center={[52.2297, 21.0122]}
            zoom={6}
            style={{ height: "80vh", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {points.map((point, index) => (
              <Marker
                key={index}
                position={[point.lat, point.lon]}
                icon={defaultIcon}
              >
                <Popup>
                  <b>{point.title}</b>
                  <p>{point.opis}</p>
                  <p>
                    <strong>Adres:</strong> {point.adres}
                  </p>
                  {point.trasa && (
                    <p>
                      <strong>Trasa:</strong> {point.trasa}
                    </p>
                  )}
                </Popup>
              </Marker>
            ))}
          </MapWithNoSSR>
        )}

        {/* Komunikat, gdy nie ma punktów na daną datę */}
        {dateRange && points.length === 0 && !loading && (
          <p className="text-center">
            Brak reklamacji na wybrany przedział dat.
          </p>
        )}
      </div>
    </div>
  );
}

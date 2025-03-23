import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/router";
import { FiLogOut } from "react-icons/fi"; // Zachowano działającą ikonę
import { FaUser, FaArchive, FaWrench } from "react-icons/fa"; // Poprawione ikonki

export default function Dashboard() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchUserRole() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error("Błąd pobierania użytkownika:", userError.message);
        setError("Nie udało się pobrać danych użytkownika.");
        setLoading(false);
        return;
      }

      if (!user) {
        setError("Nie jesteś zalogowany.");
        setLoading(false);
        return;
      }

      setUser(user);
      const { data, error } = await supabase
        .from("firmy")
        .select("rola")
        .eq("firma_id", user.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Błąd pobierania roli:", error.message);
        setError("Nie znaleziono roli użytkownika.");
      } else {
        setRole(data.rola);
      }

      setLoading(false);
    }
    fetchUserRole();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const modules = [
    { name: "Reklamacje", description: "Zarządzaj zgłoszeniami reklamacyjnymi.", link: "/reklamacje", icon: <FaWrench size={32} className="text-gray-700" /> },
    { name: "Użytkownicy", description: "Zarządzaj kontami użytkowników systemu.", link: "/uzytkownicy", adminOnly: true, icon: <FaUser size={32} className="text-gray-700" /> },
    { name: "Archiwum", description: "Przeglądaj zamknięte zgłoszenia reklamacyjne.", link: "/archiwum", icon: <FaArchive size={32} className="text-gray-700" /> },
  ];
  

  return (
    <div className="min-h-screen bg-gradient-to-r from-gray-100 to-gray-300">
      {/* Nagłówek */}
      <header className="bg-gray-900 text-white py-5 px-8 flex justify-between items-center shadow-lg">
        <h1 className="text-2xl font-bold cursor-pointer hover:text-gray-300 transition" onClick={() => router.push("/dashboard")}>
          Meblofix Sp. z o.o.
        </h1>

        {/* Informacje o użytkowniku */}
        <div className="relative">
          <div className="flex items-center space-x-4">
            {user && <span className="text-sm font-medium">{user.email}</span>}

            <button
              className="bg-red-500 text-white w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition hover:bg-red-600 cursor-pointer"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              {user?.email?.charAt(0).toUpperCase()}
            </button>
          </div>

          {/* Dropdown z opcją wylogowania */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-3 w-48 bg-white rounded-lg shadow-lg border p-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition"
              >
                <FiLogOut className="mr-2" /> Wyloguj się
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Kontener modułów */}
      <div className="max-w-5xl mx-auto py-12">
        <h2 className="text-4xl font-extrabold text-gray-900 mb-10 text-center">Wybierz moduł</h2>

        {/* Obsługa ładowania i błędów */}
        {loading ? (
          <p className="text-gray-600 text-center text-lg">Ładowanie...</p>
        ) : error ? (
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => router.push("/login")}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition text-lg"
            >
              🔑 Zaloguj się
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-6">
            {modules.map((module, index) =>
              (!module.adminOnly || role?.toLowerCase() === "admin") && (
                <a
                  key={index}
                  href={module.link}
                  className="bg-white shadow-md rounded-xl p-6 flex flex-col items-center space-y-4 hover:shadow-2xl transition transform hover:scale-105"
                >
                  <div className="bg-gray-200 p-4 rounded-full">
                    {module.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">{module.name}</h3>
                  <p className="text-gray-600 text-center">{module.description}</p>
                </a>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

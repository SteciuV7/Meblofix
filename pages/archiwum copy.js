import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/router";
import { FiLogOut } from "react-icons/fi";

export default function Archiwum() {
  const [archiwum, setArchiwum] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    fetchUser();
  }, []);

  useEffect(() => {
    async function fetchArchiwum() {
      let { data, error } = await supabase
        .from("reklamacje")
        .select("*")
        .eq("status", "Zakończone");

      if (error) {
        console.error("Błąd pobierania reklamacji:", error.message);
      } else {
        setArchiwum(data);
      }
    }
    fetchArchiwum();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const filteredReklamacje = archiwum.filter((r) =>
    r.nazwa_firmy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gray-900 text-white py-5 px-8 flex justify-between items-center shadow-lg">
        <h1 className="text-2xl font-bold cursor-pointer hover:text-gray-300 transition" onClick={() => router.push("/dashboard")}>
          Meblofix Sp. z o.o.
        </h1>

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

      {/* Główna sekcja */}
      <div className="max-w-6xl mx-auto py-10">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Archiwum reklamacji</h2>

        {/* Wyszukiwarka */}
        <div className="mb-6 flex justify-between">
          <input
            type="text"
            placeholder="Wyszukaj reklamacje..."
            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Tabela reklamacji */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-3 text-left text-black">ID</th>
                <th className="p-3 text-left text-black">Firma</th>
                <th className="p-3 text-left text-black">Opis</th>
                <th className="p-3 text-left text-black">Data zamknięcia</th>
                <th className="p-3 text-left text-black">Akcja</th>
              </tr>
            </thead>
            <tbody>
              {filteredReklamacje.length > 0 ? (
                filteredReklamacje.map((reklamacja, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-3">{reklamacja.id}</td>
                    <td className="p-3">{reklamacja.nazwa_firmy}</td>
                    <td className="p-3">{reklamacja.opis}</td>
                    <td className="p-3">{reklamacja.data_zakonczenia}</td>
                    <td className="p-3">
                      <button className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600">
                        Szczegóły
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-3 text-center text-gray-500">
                    Brak zakończonych reklamacji
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

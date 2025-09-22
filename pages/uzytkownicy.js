import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/router";
import { FiLogOut } from "react-icons/fi";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Użytkownik");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    async function fetchUsers() {
      const { data, error } = await supabase
        .from("firmy")
        .select("firma_id, nazwa_firmy, email, rola");
      if (error) {
        console.error("Błąd pobierania użytkowników:", error.message);
      } else {
        setUsers(data);
      }
    }

    async function fetchUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        console.error("Błąd pobierania danych użytkownika:", error?.message);
        setErrorMessage("Nie jesteś zalogowany. Brak dostępu!");
        return;
      }

      const { data: userData, error: roleError } = await supabase
        .from("firmy")
        .select("rola")
        .eq("email", user.email)
        .single();

      if (roleError) {
        console.error("Błąd pobierania roli:", roleError.message);
        setErrorMessage("Błąd podczas weryfikacji uprawnień.");
        return;
      }

      if (userData?.rola !== "admin") {
        setErrorMessage("Brak uprawnień do przeglądania tej strony!");
      } else {
        setUser(user);
        fetchUsers();
      }
    }

    fetchUser();
  }, []);

  if (errorMessage) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <h1 className="text-3xl font-bold text-red-600">{errorMessage}</h1>
      </div>
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const openModal = () => {
    console.log("🟢 Otwieranie okna modalnego...");
    setIsOpen(true);
  };
  const closeModal = () => {
    console.log("🔴 Zamknięcie okna modalnego...");
    setIsOpen(false);
    setEmail("");
    setPassword("");
    setCompanyName("");
    setRole("Użytkownik");
  };
  const addUser = async () => {
    console.log("🟢 Funkcja addUser została wywołana!");

    if (!email || !password || !companyName) {
      alert("Proszę wypełnić wszystkie pola!");
      return;
    }

    // Sprawdzenie, czy użytkownik już istnieje
    const { data: existingUser, error: userCheckError } = await supabase
      .from("firmy")
      .select("email")
      .filter("email", "eq", email)
      .maybeSingle();

    if (userCheckError) {
      console.error("❌ Błąd pobierania użytkownika:", userCheckError.message);
      alert("Błąd pobierania użytkownika!");
      return;
    }

    if (existingUser) {
      alert("Ten e-mail już jest zarejestrowany!");
      return;
    }

    console.log("➡️ Próba rejestracji użytkownika...");

    // Rejestracja w Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          companyName,
          display_name: companyName, // To ustawia Display name użytkownika
        },
      },
    });

    if (error) {
      console.error("❌ Błąd rejestracji użytkownika:", error.message);
      alert(`Błąd dodawania użytkownika: ${error.message}`);
      return;
    }

    console.log("✅ Użytkownik zarejestrowany:", data);
    closeModal();
    location.reload();
  };

  const deleteUser = async () => {
    if (!userToDelete) {
      console.log("❌ Brak użytkownika do usunięcia!");
      return;
    }

    console.log("🟢 Usuwanie użytkownika:", userToDelete);

    try {
      // Usuń użytkownika z Supabase Auth (API Next.js)
      const res = await fetch("/api/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: userToDelete.firma_id }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error);
      }

      console.log("✅ Użytkownik usunięty z Supabase Auth!");

      // Trigger usunie automatycznie rekord z tabeli "firmy"
      setUsers(users.filter((u) => u.firma_id !== userToDelete.firma_id));
      setConfirmDelete(false);
      setUserToDelete(null);
    } catch (error) {
      console.error("❌ Błąd usuwania użytkownika:", error.message);
      alert(`Błąd usuwania użytkownika z auth: ${error.message}`);
    }
  };
  const handleEditClick = (user) => {
    setUserToEdit(user);
    setNewEmail(user.email);
    setNewPassword("");
    setIsEditOpen(true);
  };
  const updateUser = async () => {
    if (!userToEdit) {
      alert("Nie wybrano użytkownika do edycji!");
      return;
    }

    try {
      const res = await fetch("/api/update-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userToEdit.firma_id,
          email: newEmail,
          password: newPassword,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error);
      }

      alert("✅ Dane użytkownika zaktualizowane!");
      location.reload();
    } catch (error) {
      console.error("Błąd aktualizacji:", error.message);
      alert(`❌ Błąd aktualizacji: ${error.message}`);
    }
  };
  return (
    <div className="relative min-h-screen bg-gray-100">
      {/* ✅ POPRAWIONY HEADER */}
      <header className="bg-gray-900 text-white py-5 px-8 flex justify-between items-center shadow-lg">
        <h1
          className="text-2xl font-bold cursor-pointer hover:text-gray-300 transition flex items-baseline space-x-2"
          onClick={() => router.push("/dashboard")}
        >
          <span>Meblofix Sp. z o.o.</span>
          <span className="text-sm text-gray-400 font-normal">Ver. 9.1</span>
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

      {/* ✅ RESZTA KODU BEZ ZMIAN */}
      <div className="max-w-4xl mx-auto py-10">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">
          Zarządzaj użytkownikami systemu
        </h2>

        <input
          type="text"
          placeholder="Wyszukaj..."
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900"
        />

        <div className="mt-6 bg-white shadow-md rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-3 text-left text-gray-900">Nazwa firmy</th>
                <th className="p-3 text-left text-gray-900">E-mail</th>
                <th className="p-3 text-left text-gray-900">Rola</th>
                <th className="p-3 text-left text-gray-900">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map((user, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-3 text-gray-900">{user.nazwa_firmy}</td>
                    <td className="p-3 text-gray-900">{user.email}</td>
                    <td className="p-3 text-gray-900">{user.rola}</td>
                    <td className="p-3 flex space-x-2">
                      <button
                        className="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700"
                        onClick={() => handleEditClick(user)}
                      >
                        Edytuj
                      </button>

                      <button
                        className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600"
                        onClick={() => {
                          console.log(
                            "🟢 Kliknięto 'Usuń' dla użytkownika:",
                            user
                          );
                          setUserToDelete(user);
                          setConfirmDelete(true);
                        }}
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="p-3 text-center text-gray-900">
                    Brak użytkowników
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 text-right">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            onClick={() => {
              console.log("🟢 Kliknięto przycisk Dodaj użytkownika!");
              openModal(); // ❗ To powinno otwierać okno
            }}
          >
            Dodaj użytkownika
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 flex justify-end z-50">
          <div
            className="absolute inset-0 transition-opacity"
            style={{
              background: "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4))",
            }}
            onClick={closeModal}
          ></div>

          <div className="relative w-1/3 bg-white shadow-lg p-6 rounded-l-lg z-50">
            <h2 className="text-xl font-bold text-gray-900">
              Dodaj użytkownika
            </h2>

            <label className="block mt-4 text-gray-900">E-mail</label>
            <input
              type="email"
              className="w-full p-2 border rounded-md text-gray-900"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="block mt-4 text-gray-900">Hasło</label>
            <input
              type="password"
              className="w-full p-2 border rounded-md text-gray-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label className="block mt-4 text-gray-900">Nazwa firmy</label>
            <input
              type="text"
              className="w-full p-2 border rounded-md text-gray-900"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />

            <div className="flex justify-end mt-6 space-x-2">
              <button
                className="bg-gray-700 text-white px-4 py-2 rounded-md"
                onClick={closeModal}
              >
                Zamknij
              </button>
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                onClick={addUser}
              >
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ✅ Modal potwierdzenia usunięcia */}
      {confirmDelete && userToDelete && (
        <div className="fixed inset-0 flex justify-center items-center z-50">
          <div
            className="absolute inset-0 transition-opacity"
            style={{
              background: "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4))",
            }}
            onClick={() => setConfirmDelete(false)}
          ></div>

          <div className="bg-white p-6 rounded-lg shadow-lg z-50">
            <h2 className="text-lg font-bold text-gray-900">Potwierdzenie</h2>
            <p className="text-gray-900">
              Czy na pewno chcesz usunąć użytkownika{" "}
              <b>{userToDelete?.email}</b>?
            </p>
            <div className="flex justify-end space-x-4 mt-4">
              <button
                className="bg-gray-500 text-white px-4 py-2 rounded-md"
                onClick={() => setConfirmDelete(false)}
              >
                Anuluj
              </button>
              <button
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                onClick={deleteUser}
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
      {isEditOpen && userToEdit && (
        <div className="fixed inset-0 flex justify-center items-center z-50">
          <div
            className="absolute inset-0 transition-opacity"
            style={{
              background: "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4))",
            }}
          ></div>

          <div className="bg-white p-6 rounded-lg shadow-lg z-50 w-1/3">
            <h2 className="text-lg font-bold text-gray-900">
              Edytuj użytkownika: {userToEdit.email}
            </h2>

            <label className="block text-gray-900">Nowy Email</label>
            <input
              className="w-full p-2 border rounded-md text-gray-900"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />

            <label className="block text-gray-900 mt-3">
              Nowe Hasło (opcjonalnie)
            </label>
            <input
              className="w-full p-2 border rounded-md text-gray-900"
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <div className="flex justify-end space-x-2 mt-4">
              <button
                className="bg-gray-500 text-white px-4 py-2 rounded-md"
                onClick={() => setIsEditOpen(false)}
              >
                Anuluj
              </button>
              <button
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                onClick={updateUser}
              >
                Zapisz zmiany
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/router";
import Image from "next/image";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Niepoprawne dane logowania.");
    } else {
      // Przekierowanie po poprawnym logowaniu
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:h-screen">
      {/* Lewa sekcja: formularz */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 md:px-16 py-10 bg-gray-100 min-h-screen md:min-h-0">
        <h1 className="text-lg font-semibold text-gray-600 uppercase tracking-wide mb-2">
          System reklamacji Meblofix
        </h1>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Zaloguj się i działaj!
        </h1>
        <p className="text-gray-700 mb-6">Meblofix Sp. z o.o.</p>
        <p className="text-gray-600 mb-8">
          Wpisz swój email oraz hasło, aby się zalogować.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-gray-700">E-mail</label>
            <input
              type="email"
              placeholder="Wpisz e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg shadow-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-gray-700">Hasło</label>
            <input
              type="password"
              placeholder="Wpisz hasło"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg shadow-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {error && <p className="text-red-600">{error}</p>}

          <button
            type="submit"
            className="w-full flex items-center justify-center bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition shadow-md hover:shadow-lg"
          >
            🔑 Zaloguj się
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-500">
          © Powered by <span className="text-indigo-600 font-bold">CP&BS</span>.
        </p>
      </div>

      {/* Prawa sekcja: obraz — widoczna tylko na desktopie */}
      <div className="hidden md:block w-1/2 relative">
        <div className="absolute inset-0 bg-black opacity-30 z-10"></div>
        <Image
          src="/login-bg.webp"
          alt="Tło logowania"
          layout="fill"
          objectFit="cover"
          className="z-0"
          unoptimized
        />
      </div>
    </div>
  );
}

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { userId, email, password } = req.body;

    // Walidacja danych wejściowych
    if (!userId || (!email && !password)) {
      return res
        .status(400)
        .json({ error: "Brak wymaganych danych (userId, email lub password)" });
    }

    const updateData = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password;

    console.log("🔄 Aktualizacja użytkownika:", userId, updateData);

    const { data, error } = await supabase.auth.admin.updateUserById(
      userId,
      updateData
    );

    if (error) {
      console.error("❌ Błąd aktualizacji użytkownika:", error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log("✅ Użytkownik zaktualizowany:", data);
    return res.status(200).json({ message: "Użytkownik zaktualizowany", data });
  } catch (error) {
    console.error("❌ Błąd wewnętrzny serwera:", error.message);
    return res.status(500).json({ error: "Wewnętrzny błąd serwera" });
  }
}

// pages/api/delete-user.js
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

    const { userId } = req.body;

    // Walidacja danych wejściowych
    if (!userId) {
      return res.status(400).json({ error: "Brak wymaganych danych (userId)" });
    }

    console.log("🗑️ Próba usunięcia użytkownika o ID:", userId);

    // Próba usunięcia użytkownika
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      console.error(
        "❌ Błąd usuwania użytkownika z Supabase Auth:",
        error.message
      );
      return res.status(400).json({ error: error.message });
    }

    console.log("✅ Użytkownik usunięty z Supabase Auth:", userId);
    return res.status(200).json({ message: "Użytkownik usunięty pomyślnie" });
  } catch (error) {
    console.error(
      "❌ Wewnętrzny błąd serwera podczas usuwania użytkownika:",
      error.message
    );
    return res.status(500).json({ error: "Wewnętrzny błąd serwera" });
  }
}

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { userId, email, password } = req.body;

  const updateData = {};
  if (email) updateData.email = email;
  if (password) updateData.password = password;

  const { error } = await supabase.auth.admin.updateUserById(userId, updateData);

  if (error) {
    console.error("❌ Błąd aktualizacji użytkownika:", error.message);
    return res.status(400).json({ error: error.message });
  }

  console.log("✅ Użytkownik zaktualizowany:", userId);
  return res.status(200).json({ message: "Użytkownik zaktualizowany" });
};
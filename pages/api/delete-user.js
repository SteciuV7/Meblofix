// pages/api/delete-user.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { userId } = req.body;

  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    console.error('❌ Błąd usuwania użytkownika z Supabase Auth:', error);
    return res.status(400).json({ error: error.message });
  }

  console.log('✅ Użytkownik usunięty z Supabase Auth:', userId);
  return res.status(200).json({ message: 'User deleted successfully' });
};
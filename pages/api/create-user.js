import { ROLE } from "@/lib/constants";
import { requireApiUser } from "@/lib/server/auth";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

function normalizeEmail(value) {
  const normalized = `${value || ""}`.trim().toLowerCase();
  return normalized || null;
}

function normalizeRole(value) {
  const normalized = `${value || ""}`.trim().toLowerCase();

  if (normalized === ROLE.ADMIN) {
    return ROLE.ADMIN;
  }

  return ROLE.USER;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireApiUser(req, { adminOnly: true });

    const supabase = getSupabaseAdmin();
    const { email, password, companyName, role } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const normalizedCompanyName = `${companyName || ""}`.trim();

    if (!normalizedEmail || !password || !normalizedCompanyName) {
      return res.status(400).json({
        error: "Brak wymaganych danych (email, password, companyName).",
      });
    }

    const { data: existingCompany, error: existingCompanyError } = await supabase
      .from("firmy")
      .select("firma_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingCompanyError) {
      return res.status(400).json({ error: existingCompanyError.message });
    }

    if (existingCompany) {
      return res.status(409).json({ error: "Ten e-mail jest juz zarejestrowany." });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        companyName: normalizedCompanyName,
        display_name: normalizedCompanyName,
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const authUser = data?.user;
    if (!authUser?.id) {
      return res.status(500).json({ error: "Nie utworzono uzytkownika w Auth." });
    }

    const { error: profileError } = await supabase.from("firmy").insert({
      firma_id: authUser.id,
      email: normalizedEmail,
      nazwa_firmy: normalizedCompanyName,
      rola: normalizeRole(role),
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(authUser.id);
      return res.status(400).json({ error: profileError.message });
    }

    return res.status(201).json({
      message: "Uzytkownik utworzony i potwierdzony.",
      user: {
        id: authUser.id,
        email: authUser.email,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Wewnetrzny blad serwera.",
    });
  }
}

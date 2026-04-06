import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

function normalizeEmail(value) {
  const normalized = `${value || ""}`.trim().toLowerCase();
  return normalized || null;
}

async function loadCompanyUser(supabase, userId) {
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("firmy")
    .select("firma_id, email, nazwa_firmy")
    .eq("firma_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function findAuthUserByEmail(supabase, email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const matchedUser = (data?.users || []).find(
      (user) => normalizeEmail(user.email) === normalizedEmail
    );

    if (matchedUser) {
      return matchedUser;
    }

    if (!data?.nextPage || page >= (data?.lastPage || page)) {
      return null;
    }

    page = data.nextPage;
  }
}

async function resolveAuthUser({ supabase, userId, currentEmail, nextEmail }) {
  const companyUser = await loadCompanyUser(supabase, userId);

  if (userId) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (error && !/user not found/i.test(error.message || "")) {
      throw error;
    }

    if (data?.user) {
      return {
        authUser: data.user,
        companyUser,
      };
    }
  }

  const candidateEmails = [
    normalizeEmail(currentEmail),
    normalizeEmail(companyUser?.email),
    normalizeEmail(nextEmail),
  ].filter(Boolean);

  for (const email of [...new Set(candidateEmails)]) {
    const authUser = await findAuthUserByEmail(supabase, email);

    if (authUser) {
      return {
        authUser,
        companyUser,
      };
    }
  }

  const error = new Error("Nie znaleziono powiazanego uzytkownika w Supabase Auth.");
  error.statusCode = 404;
  throw error;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { userId, email, currentEmail, password } = req.body || {};

    if (!userId || (!email && !password)) {
      return res.status(400).json({
        error: "Brak wymaganych danych (userId, email lub password).",
      });
    }

    const { authUser, companyUser } = await resolveAuthUser({
      supabase,
      userId,
      currentEmail,
      nextEmail: email,
    });

    const updateData = {};
    if (email) {
      updateData.email = email;
    }
    if (password) {
      updateData.password = password;
    }

    const { data, error } = await supabase.auth.admin.updateUserById(
      authUser.id,
      updateData
    );

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const normalizedNextEmail = normalizeEmail(email);
    const normalizedCompanyEmail = normalizeEmail(companyUser?.email);

    if (
      normalizedNextEmail &&
      userId &&
      normalizedNextEmail !== normalizedCompanyEmail
    ) {
      const { error: companyUpdateError } = await supabase
        .from("firmy")
        .update({ email: email.trim() })
        .eq("firma_id", userId);

      if (companyUpdateError) {
        return res.status(400).json({ error: companyUpdateError.message });
      }
    }

    return res.status(200).json({
      message: "Uzytkownik zaktualizowany.",
      data,
      authUserId: authUser.id,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Wewnetrzny blad serwera.",
    });
  }
}

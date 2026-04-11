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

async function findAuthUserByEmail(supabase, email) {
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
      (user) => normalizeEmail(user.email) === email
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

    let authUser = await findAuthUserByEmail(supabase, normalizedEmail);

    if (authUser) {
      const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
        email_confirm: true,
        password,
        user_metadata: {
          ...(authUser.user_metadata || {}),
          companyName: normalizedCompanyName,
          display_name: normalizedCompanyName,
        },
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      authUser = data?.user || authUser;
    } else {
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

      authUser = data?.user;
      if (!authUser?.id) {
        return res.status(500).json({ error: "Nie utworzono uzytkownika w Auth." });
      }
    }

    const profilePayload = {
      firma_id: authUser.id,
      email: normalizedEmail,
      nazwa_firmy: normalizedCompanyName,
      rola: normalizeRole(role),
    };

    const { error: profileError } = await supabase
      .from("firmy")
      .upsert(profilePayload, { onConflict: "firma_id" });

    if (profileError) {
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

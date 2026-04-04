import { supabase } from "@/lib/supabase";

export async function apiFetch(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const isHtmlError =
      typeof payload === "string" &&
      (contentType.includes("text/html") ||
        payload.includes("<!DOCTYPE html") ||
        payload.includes("<html"));

    const message = isHtmlError
      ? `Serwer zwrocil blad ${response.status} dla ${path}. Sprawdz terminal Next.js i zrestartuj dev server.`
      : typeof payload === "string"
        ? payload
        : payload?.error || payload?.message || "Wystapil blad zadania.";

    throw new Error(message);
  }

  return payload;
}

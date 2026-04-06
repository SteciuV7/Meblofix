const DEFAULT_APP_BASE_URLS = {
  development: "http://localhost:3000",
  preview: "https://meblofix-git-stage-meblofix.vercel.app",
  production: "https://meblofix.pl",
};

function normalizeBaseUrl(value) {
  return `${value || ""}`.trim().replace(/\/+$/, "");
}

export function getAppBaseUrl() {
  const explicitBaseUrl = normalizeBaseUrl(process.env.APP_BASE_URL);
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  if (process.env.NODE_ENV === "development") {
    return DEFAULT_APP_BASE_URLS.development;
  }

  if (process.env.VERCEL_ENV === "preview") {
    return DEFAULT_APP_BASE_URLS.preview;
  }

  return DEFAULT_APP_BASE_URLS.production;
}

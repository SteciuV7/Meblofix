const DEFAULT_APP_BASE_URLS = {
  development: "http://localhost:3000",
  preview: "https://meblofix-git-stage-meblofix.vercel.app",
  production: "https://meblofix.pl",
};

function normalizeBaseUrl(value) {
  return `${value || ""}`.trim().replace(/\/+$/, "");
}

function normalizeHostedUrl(value) {
  const normalized = normalizeBaseUrl(value);

  if (!normalized) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  return `https://${normalized}`;
}

export function getAppBaseUrl() {
  const explicitBaseUrl = [
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
  ]
    .map(normalizeBaseUrl)
    .find(Boolean);

  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const vercelProductionUrl = normalizeHostedUrl(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  );
  if (vercelProductionUrl) {
    return vercelProductionUrl;
  }

  if (process.env.NODE_ENV === "development") {
    return DEFAULT_APP_BASE_URLS.development;
  }

  if (process.env.VERCEL_ENV === "preview") {
    return DEFAULT_APP_BASE_URLS.preview;
  }

  return DEFAULT_APP_BASE_URLS.production;
}

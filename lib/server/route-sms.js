import crypto from "crypto";
import { getAppBaseUrl } from "@/lib/server/app-base-url";
import { formatSmsTimeWindow, removePolishCharacters } from "@/lib/utils";

const SMS_ETA_BUFFER_MINUTES = 30;

function createHttpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeSmsValue(value = "") {
  return removePolishCharacters(String(value || ""))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSmsRecipient(phone = "") {
  const digits = String(phone || "").replace(/\D/g, "");

  if (/^\d{9}$/.test(digits)) {
    return `48${digits}`;
  }

  if (/^48\d{9}$/.test(digits)) {
    return digits;
  }

  throw createHttpError("Nieprawidlowy numer telefonu odbiorcy SMS.", 422);
}

export function createSmsConfirmationToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function hashSmsConfirmationToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function buildRouteConfirmationLongUrl(token) {
  return `${getAppBaseUrl()}/p/${encodeURIComponent(token)}`;
}

function shiftIsoByMinutes(value, minutes) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
}

export function formatRouteSmsWindow(stop) {
  const etaFrom = stop?.eta_from || stop?.etaFrom || null;
  const etaTo = stop?.eta_to || stop?.etaTo || null;

  return formatSmsTimeWindow(
    shiftIsoByMinutes(etaFrom, -SMS_ETA_BUFFER_MINUTES),
    shiftIsoByMinutes(etaTo, SMS_ETA_BUFFER_MINUTES)
  );
}

export function renderSmsTemplate(template, variables = {}) {
  let message = normalizeSmsValue(template || "");

  Object.entries(variables).forEach(([key, value]) => {
    message = message.split(`{{${key}}}`).join(normalizeSmsValue(value || ""));
  });

  return message
    .replace(/{{[^}]+}}/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s([,.!?;:])/g, "$1")
    .trim();
}

export async function shortenUrlWithIdzDo(url) {
  const login = `${process.env.IDZDO_LOGIN || ""}`.trim();
  const password = `${process.env.IDZDO_PASSWORD || ""}`.trim();

  if (!login || !password) {
    return {
      shortUrl: url,
      provider: "raw",
      payload: null,
    };
  }

  const credentials = Buffer.from(`${login}:${password}`).toString("base64");
  const response = await fetch("https://idz-do.pl/api/v2/?mode=insert", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ url }),
  });

  const rawPayload = await response.text();
  let payload = null;

  try {
    payload = rawPayload ? JSON.parse(rawPayload) : null;
  } catch {
    payload = rawPayload;
  }

  if (!response.ok) {
    throw createHttpError(
      `Idz.do zwrocil blad ${response.status} podczas skracania linku.`,
      502
    );
  }

  if (!payload || payload.response !== "ok" || !payload.shortlink) {
    throw createHttpError("Idz.do nie zwrocil poprawnego skroconego linku.", 502);
  }

  return {
    shortUrl: `https://idz.do/${payload.shortlink}`,
    provider: "idzdo",
    payload,
  };
}

export async function sendSmsMessage({ to, message }) {
  const smsApiToken = `${process.env.SMSAPI || ""}`.trim();
  const sender = normalizeSmsValue(process.env.POLE_NADAWCY || "");

  if (!smsApiToken) {
    throw createHttpError("Brak zmiennej srodowiskowej SMSAPI.", 500);
  }

  if (!sender) {
    throw createHttpError("Brak zmiennej srodowiskowej POLE_NADAWCY.", 500);
  }

  const recipient = normalizeSmsRecipient(to);
  const normalizedMessage = normalizeSmsValue(message);

  if (!normalizedMessage) {
    throw createHttpError("Tresc SMS nie moze byc pusta.", 422);
  }

  const response = await fetch("https://api.smsapi.pl/sms.do", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${smsApiToken}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      to: recipient,
      from: sender,
      message: normalizedMessage,
      format: "json",
      normalize: "1",
    }),
  });

  const rawPayload = await response.text();
  let payload = null;

  try {
    payload = rawPayload ? JSON.parse(rawPayload) : null;
  } catch {
    payload = rawPayload;
  }

  if (!response.ok) {
    throw createHttpError(
      `SMSAPI zwrocil blad ${response.status} podczas wysylki SMS.`,
      502
    );
  }

  return {
    to: recipient,
    message: normalizedMessage,
    provider: "smsapi",
    payload,
  };
}

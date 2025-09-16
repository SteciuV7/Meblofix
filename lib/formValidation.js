// lib/formValidation.js

// Polskie litery:
const PL_UPPER = "A-ZĄĆĘŁŃÓŚŹŻ";
const PL_LOWER = "a-ząćęłńóśźż";

// Wg Twoich wytycznych: w miejscowości BEZ interpunkcji (również bez "-")
const ALLOW_TOWN_HYPHEN = false;

// === Helpers ===
export function normalizeSpaces(s) {
  return s.replace(/\s+/g, " ").trim();
}

// NOWE: normalizacja do użycia "podczas wpisywania" – zachowuje jedną końcową spację
export function normalizeSpacesTyping(s = "") {
  const hadTrailing = /\s$/.test(s);
  const core = s.replace(/\s+/g, " ").trim();
  return core ? (hadTrailing ? core + " " : core) : (hadTrailing ? " " : "");
}

export function toTitleCasePlWord(w) {
  return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w;
}

// liczby rzymskie (np. "III")
const ROMAN_RE = /\b[IVXLCDM]{1,6}\b/;

// === Kod pocztowy ===
export function validatePostalCode(v) {
  return /^\d{2}-\d{3}$/.test(v);
}

// formatowanie „po blur” – jeśli user wpisał 5 cyfr, wstaw myślnik 2-3
export function formatPostalOnBlur(v) {
  const digits = (v || "").replace(/\D/g, "").slice(0, 5);
  if (digits.length === 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return (v || "").trim();
}

// filtrowanie „w trakcie pisania” – dopuszczamy cyfry i myślnik, max 6 znaków
export function filterPostalOnChange(v) {
  let s = (v || "").replace(/[^\d-]/g, "");
  // tylko jeden myślnik
  s = s.replace(/-+/g, "-").slice(0, 6);
  return s; // (bez trim – nie dotykamy spacji na końcu ogólnie w onChange)
}

// (bez zmian)
export function postalError(v) {
  if (!v) return "";
  if (!/^\d{0,2}(-?\d{0,3})?$/.test(v))
    return "Dozwolone tylko cyfry i ewentualny myślnik.";
  if (v.length > 0 && v.length < 6) return "Format: 12-345 (5 cyfr).";
  if (!validatePostalCode(v)) return "Kod pocztowy musi mieć format XX-XXX.";
  return "";
}

// === MIEJSCOWOŚĆ ===

// NOWE: wariant do onChange (zachowuje ewentualną spację końcową)
export function sanitizeTownOnChange(input) {
  let s = normalizeSpacesTyping(input || "");

  // tylko litery PL i spacje (bez myślników, bez interpunkcji)
  const hadTrailing = /\s$/.test(s);
  s = s.replace(new RegExp(`[^${PL_UPPER}${PL_LOWER}\\s]`, "gu"), "");
  s = normalizeSpacesTyping(s);

  // każde słowo z wielkiej litery (nie psujemy końcowej spacji)
  const core = s.trimEnd()
    .split(" ")
    .filter(Boolean)
    .map((part) => toTitleCasePlWord(part))
    .join(" ");
  return hadTrailing ? (core ? core + " " : " ") : core;
}

// Dotychczasowy sanitize – używaj np. w onBlur/submit
export function sanitizeTown(input) {
  let s = normalizeSpaces(input || "");
  s = s.replace(new RegExp(`[^${PL_UPPER}${PL_LOWER}\\s]`, "gu"), "");
  s = normalizeSpaces(s);
  s = s
    .split(" ")
    .map((part) => toTitleCasePlWord(part))
    .join(" ");
  return s;
}

export function validateTown(value) {
  const v = normalizeSpaces(value || "");
  if (!v || v.length < 2) return false;

  const WORD = new RegExp(`^[${PL_UPPER}][${PL_LOWER}]+$`, "u");
  const parts = v.split(" ");
  if (!parts.every((p) => WORD.test(p))) return false;

  if (/\b(woj\.?|pow\.?|gm\.?|polska)\b/i.test(v)) return false;

  return true;
}

export function townError(value) {
  const v = value || "";
  if (!v) return "";
  if (v.trim().length < 2) return "Miejscowość musi mieć co najmniej 2 znaki.";
  if (/[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż\s]/.test(v))
    return "Dozwolone tylko litery i spacje.";
  const parts = normalizeSpaces(v).split(" ");
  const wrong = parts.find((p) => p && p[0] !== p[0].toUpperCase());
  if (wrong) return "Każde słowo musi zaczynać się wielką literą.";
  if (!validateTown(v)) return "Niewłaściwy format miejscowości.";
  return "";
}

// === ADRES ===

// zakaz: przecinki, kropki, średniki, backslash, dwukropek
// musi kończyć się numerem domu – WYŁĄCZONE
const HOUSE_NUM_RE = /\b\d+[A-Za-z]?(?:\/\d+[A-Za-z]?)?$/;
// NOWE: przełącznik wymagania numeru domu na końcu
const REQUIRE_HOUSE_AT_END = false;

// NOWE: wariant do onChange (zachowuje spację na końcu)
export function sanitizeAddressOnChange(input) {
  let s = normalizeSpacesTyping(input || "");
  // usuń niedozwolone znaki
  const hadTrailing = /\s$/.test(s);
  s = s.replace(/[,\.;:\\:]+/g, "");
  s = normalizeSpacesTyping(s);

  const core = s.trimEnd()
    .split(" ")
    .filter(Boolean)
    .map((tok) => {
      if (ROMAN_RE.test(tok)) return tok;
      if (/^\d+[A-Za-z]?$/.test(tok)) return tok;        // 12 lub 12A
      if (/^\d+[A-Za-z]?\/\d+[A-Za-z]?$/.test(tok)) return tok; // 12/4 lub 12A/4B
      return toTitleCasePlWord(tok);
    })
    .join(" ");

  return hadTrailing ? (core ? core + " " : " ") : core;
}

// Dotychczasowy sanitize – używaj np. w onBlur/submit
export function sanitizeAddress(input) {
  let s = normalizeSpaces(input || "");
  s = s.replace(/[,\.;:\\:]+/g, "");

  s = s
    .split(" ")
    .map((tok) => {
      if (ROMAN_RE.test(tok)) return tok; // III, IV...
      if (/^\d+[A-Za-z]?$/.test(tok)) return tok; // 12 lub 12A
      if (/^\d+[A-Za-z]?\/\d+[A-Za-z]?$/.test(tok)) return tok; // 12/4 lub 12A/4B
      return toTitleCasePlWord(tok);
    })
    .join(" ");

  return s;
}

export function validateAddress(value) {
  const s = normalizeSpaces(value || "");
  if (!s) return false;
  if (s.length < 5 || s.length > 120) return false;
  if (/[,\.;:\\:]/.test(s)) return false;
  if (/\/{2,}/.test(s)) return false;
  if (/\s\/|\/\s/.test(s)) return false;

  // WYŁĄCZONE: adres nie musi kończyć się numerem domu
  if (REQUIRE_HOUSE_AT_END && !HOUSE_NUM_RE.test(s)) return false;

  return true;
}

export function addressError(value) {
  const s = value || "";
  if (!s) return "";
  if (/[,\.;:\\:]/.test(s))
    return "Adres nie może zawierać przecinków/kropek/średników/\\/:.";
  if (s.trim().length < 5) return "Adres jest za krótki.";
  if (/\/{2,}/.test(s) || /\s\/|\/\s/.test(s))
    return "Niepoprawny separator lokalu. Użyj np. „12/4”.";

  // Komunikat o numerze domu pokazujemy tylko, jeśli wymaganie jest włączone
  if (REQUIRE_HOUSE_AT_END && !HOUSE_NUM_RE.test(s))
    return "Adres musi kończyć się numerem domu (np. 12, 12A, 12/4).";

  if (!validateAddress(s)) return "Niepoprawny format adresu.";
  return "";
}

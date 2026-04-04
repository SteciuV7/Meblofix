export function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

export function sendError(res, error) {
  const statusCode = error.statusCode || 500;
  const message = error.message || "Wewnetrzny blad serwera.";

  console.error("[api]", statusCode, error);
  res.status(statusCode).json({ error: message });
}

export function requireMethod(req, res, allowedMethods) {
  if (allowedMethods.includes(req.method)) {
    return true;
  }

  res.setHeader("Allow", allowedMethods.join(", "));
  sendJson(res, 405, { error: "Method not allowed" });
  return false;
}

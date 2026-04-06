import { getPublicSmsConfirmationPreview } from "@/lib/server/trasy";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["GET"])) {
    return;
  }

  try {
    const detail = await getPublicSmsConfirmationPreview(req.query.token);
    sendJson(res, 200, detail);
  } catch (error) {
    sendError(res, error);
  }
}

import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import { sendRouteConfirmationSmsBatch } from "@/lib/server/trasy";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["POST"])) {
    return;
  }

  try {
    const actor = await requireApiUser(req, { adminOnly: true });
    const result = await sendRouteConfirmationSmsBatch(req.query.id, actor);
    sendJson(res, 200, result);
  } catch (error) {
    sendError(res, error);
  }
}

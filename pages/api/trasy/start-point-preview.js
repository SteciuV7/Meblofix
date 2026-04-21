import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import { previewRouteStartPoint } from "@/lib/server/trasy";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["POST"])) {
    return;
  }

  try {
    await requireApiUser(req, { adminOnly: true });
    const preview = await previewRouteStartPoint(req.body || {});
    sendJson(res, 200, preview);
  } catch (error) {
    sendError(res, error);
  }
}

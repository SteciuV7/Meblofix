import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import { getRouteDetail } from "@/lib/server/trasy";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["GET"])) {
    return;
  }

  try {
    await requireApiUser(req, { adminOnly: true });
    const detail = await getRouteDetail(req.query.id);
    sendJson(res, 200, detail);
  } catch (error) {
    sendError(res, error);
  }
}

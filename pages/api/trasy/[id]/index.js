import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import { cancelPlannedRoute, getRouteDetail } from "@/lib/server/trasy";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["GET", "DELETE"])) {
    return;
  }

  try {
    const actor = await requireApiUser(req, { adminOnly: true });

    if (req.method === "DELETE") {
      const result = await cancelPlannedRoute({
        routeId: req.query.id,
        actor,
      });
      sendJson(res, 200, result);
      return;
    }

    const detail = await getRouteDetail(req.query.id);
    sendJson(res, 200, detail);
  } catch (error) {
    sendError(res, error);
  }
}

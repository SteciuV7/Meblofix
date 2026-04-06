import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import { updateRouteStopSmsConfirmationStatus } from "@/lib/server/trasy";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["PATCH"])) {
    return;
  }

  try {
    const actor = await requireApiUser(req, { adminOnly: true });
    const result = await updateRouteStopSmsConfirmationStatus({
      routeId: req.query.id,
      stopId: req.query.stopId,
      status: req.body?.status,
      actor,
    });
    sendJson(res, 200, { stop: result });
  } catch (error) {
    sendError(res, error);
  }
}

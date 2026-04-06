import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import { sendRouteStopConfirmationSms } from "@/lib/server/trasy";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["POST"])) {
    return;
  }

  try {
    const actor = await requireApiUser(req, { adminOnly: true });
    const result = await sendRouteStopConfirmationSms(
      req.query.id,
      req.query.stopId,
      actor
    );
    sendJson(res, 200, result);
  } catch (error) {
    sendError(res, error);
  }
}

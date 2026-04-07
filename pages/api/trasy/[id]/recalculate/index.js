import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import { recalculateRoute } from "@/lib/server/trasy";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["POST"])) {
    return;
  }

  try {
    const actor = await requireApiUser(req, { adminOnly: true });
    const {
      reklamacjeIds = [],
      planowanyStartAt,
      resetSmsConfirmations = false,
      czasyPostojuMinByReklamacjaId = {},
    } = req.body || {};
    const result = await recalculateRoute({
      routeId: req.query.id,
      reklamacjeIds,
      planowanyStartAt,
      actor,
      resetSmsConfirmations,
      czasyPostojuMinByReklamacjaId,
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendError(res, error);
  }
}

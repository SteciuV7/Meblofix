import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import { acknowledgeComplaintSmsRejectionAlert } from "@/lib/server/reklamacje";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["POST"])) {
    return;
  }

  try {
    const actor = await requireApiUser(req);
    const result = await acknowledgeComplaintSmsRejectionAlert({
      reklamacjaId: req.query.id,
      actor,
    });

    sendJson(res, 200, result);
  } catch (error) {
    sendError(res, error);
  }
}

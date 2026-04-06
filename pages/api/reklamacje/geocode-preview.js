import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import { previewComplaintGeocode } from "@/lib/server/reklamacje";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["POST"])) {
    return;
  }

  try {
    await requireApiUser(req);
    const preview = await previewComplaintGeocode({
      payload: req.body || {},
    });

    sendJson(res, 200, preview);
  } catch (error) {
    sendError(res, error);
  }
}

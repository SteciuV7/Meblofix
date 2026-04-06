import { requireApiUser } from "@/lib/server/auth";
import {
  getOperationalSettings,
  updateOperationalSettings,
} from "@/lib/server/operational";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["GET", "PATCH"])) {
    return;
  }

  try {
    await requireApiUser(req, { adminOnly: true });

    if (req.method === "GET") {
      const settings = await getOperationalSettings({ required: true });
      sendJson(res, 200, { settings });
      return;
    }

    const { id, ...payload } = req.body || {};
    const settings = await updateOperationalSettings(id, payload);
    sendJson(res, 200, { settings });
  } catch (error) {
    sendError(res, error);
  }
}

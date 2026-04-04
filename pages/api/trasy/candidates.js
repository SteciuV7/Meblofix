import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import { getOperationalSettings } from "@/lib/server/operational";
import { listRouteCandidates } from "@/lib/server/trasy";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["GET"])) {
    return;
  }

  try {
    await requireApiUser(req, { adminOnly: true });
    const reklamacje = await listRouteCandidates();
    const settings = await getOperationalSettings();
    sendJson(res, 200, { reklamacje, settings });
  } catch (error) {
    sendError(res, error);
  }
}

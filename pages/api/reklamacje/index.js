import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import {
  createReklamacjaRecord,
  listReklamacjeRecords,
} from "@/lib/server/reklamacje";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["GET", "POST"])) {
    return;
  }

  try {
    const actor = await requireApiUser(req);

    if (req.method === "GET") {
      const reklamacje = await listReklamacjeRecords({ actor });
      sendJson(res, 200, { reklamacje });
      return;
    }

    const body = req.body || {};
    const { addressApprovalMode = "exact", ...payload } = body;
    const created = await createReklamacjaRecord({
      payload,
      actor,
      addressApprovalMode,
    });

    sendJson(res, 201, { reklamacja: created });
  } catch (error) {
    sendError(res, error);
  }
}

import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import { createReklamacjaRecord } from "@/lib/server/reklamacje";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["POST"])) {
    return;
  }

  try {
    const actor = await requireApiUser(req);
    const created = await createReklamacjaRecord({
      payload: req.body || {},
      actor,
    });

    sendJson(res, 201, { reklamacja: created });
  } catch (error) {
    sendError(res, error);
  }
}

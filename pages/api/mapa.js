import { ROLE } from "@/lib/constants";
import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import {
  listComplaintMapCompanies,
  listComplaintMapRecords,
} from "@/lib/server/reklamacje";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["GET"])) {
    return;
  }

  try {
    const actor = await requireApiUser(req);
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const firmaId =
      typeof req.query.firmaId === "string" ? req.query.firmaId : "";

    const reklamacje = await listComplaintMapRecords({
      actor,
      status,
      firmaId,
    });

    const firmy =
      actor.role === ROLE.ADMIN
        ? await listComplaintMapCompanies({ actor })
        : [];

    sendJson(res, 200, { reklamacje, firmy });
  } catch (error) {
    sendError(res, error);
  }
}

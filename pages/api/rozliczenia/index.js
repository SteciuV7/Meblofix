import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import {
  listSettlementCompanies,
  listSettlementComplaints,
} from "@/lib/server/rozliczenia";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["GET"])) {
    return;
  }

  try {
    const actor = await requireApiUser(req, { adminOnly: true });
    const companies = await listSettlementCompanies({ actor });
    const complaints = await listSettlementComplaints({
      actor,
      firmaId: req.query.firmaId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    sendJson(res, 200, {
      companies,
      complaints,
    });
  } catch (error) {
    sendError(res, error);
  }
}

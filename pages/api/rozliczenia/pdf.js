import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError } from "@/lib/server/http";
import { generateSettlementPdf } from "@/lib/server/rozliczenia";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["POST"])) {
    return;
  }

  try {
    const actor = await requireApiUser(req, { adminOnly: true });
    const { firmaId, dateFrom, dateTo, reklamacjeIds = [] } = req.body || {};
    const result = await generateSettlementPdf({
      actor,
      firmaId,
      dateFrom,
      dateTo,
      reklamacjeIds,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`
    );
    res.status(200).send(result.buffer);
  } catch (error) {
    sendError(res, error);
  }
}

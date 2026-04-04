import { ROLE, ROUTE_STATUS } from "@/lib/constants";
import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import {
  computeRoutePreview,
  createRoute,
  listActiveRoutes,
} from "@/lib/server/trasy";

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["GET", "POST"])) {
    return;
  }

  try {
    const actor = await requireApiUser(req, {
      adminOnly: true,
    });

    if (req.method === "GET") {
      const statuses = req.query.statuses
        ? String(req.query.statuses)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : undefined;

      const routes = await listActiveRoutes({
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        statuses:
          statuses && statuses.length
            ? statuses
            : [ROUTE_STATUS.PLANNED, ROUTE_STATUS.IN_PROGRESS, ROUTE_STATUS.COMPLETED],
      });

      sendJson(res, 200, { routes });
      return;
    }

    const {
      reklamacjeIds = [],
      planowanyStartAt,
      driverFirmaId,
      routeName,
      notes,
      dryRun = false,
      optimize = true,
    } = req.body || {};

    if (!planowanyStartAt) {
      throw new Error("Brak planowanej godziny startu.");
    }

    if (dryRun) {
      const preview = await computeRoutePreview({
        reklamacjeIds,
        planowanyStartAt,
        optimize,
      });
      sendJson(res, 200, preview);
      return;
    }

    const result = await createRoute({
      reklamacjeIds,
      planowanyStartAt,
      driverFirmaId,
      routeName,
      notes,
      actor,
      optimize,
    });

    sendJson(res, 201, result);
  } catch (error) {
    sendError(res, error);
  }
}

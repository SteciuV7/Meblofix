import { REKLAMACJA_STATUS, ROLE } from "@/lib/constants";
import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import {
  getReklamacjaDetail,
  transitionComplaintStatus,
} from "@/lib/server/reklamacje";

function requireAdmin(actor) {
  if (actor.role !== ROLE.ADMIN) {
    const error = new Error("Brak uprawnień.");
    error.statusCode = 403;
    throw error;
  }
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ["GET", "PATCH"])) {
    return;
  }

  try {
    const actor = await requireApiUser(req);
    const reklamacjaId = req.query.id;

    if (req.method === "GET") {
      const detail = await getReklamacjaDetail({ reklamacjaId, actor });
      sendJson(res, 200, detail);
      return;
    }

    const { action = "update", payload = {} } = req.body || {};

    switch (action) {
      case "accept": {
        requireAdmin(actor);
        const reklamacja = await transitionComplaintStatus({
          reklamacjaId,
          actor,
          nextStatus: REKLAMACJA_STATUS.IN_PROGRESS,
          action: "reklamacja_accepted",
        });
        sendJson(res, 200, { reklamacja });
        return;
      }
      case "request-info": {
        requireAdmin(actor);
        const reklamacja = await transitionComplaintStatus({
          reklamacjaId,
          actor,
          nextStatus: REKLAMACJA_STATUS.WAITING_INFO,
          action: "reklamacja_waiting_info",
        });
        sendJson(res, 200, { reklamacja });
        return;
      }
      case "waiting-delivery": {
        requireAdmin(actor);
        const reklamacja = await transitionComplaintStatus({
          reklamacjaId,
          actor,
          nextStatus: REKLAMACJA_STATUS.WAITING_DELIVERY,
          action: "reklamacja_waiting_delivery",
        });
        sendJson(res, 200, { reklamacja });
        return;
      }
      case "close": {
        requireAdmin(actor);
        const reklamacja = await transitionComplaintStatus({
          reklamacjaId,
          actor,
          nextStatus: REKLAMACJA_STATUS.DONE,
          action: "reklamacja_closed_manual",
          patch: {
            ...payload,
            data_zakonczenia: new Date().toISOString(),
          },
        });
        sendJson(res, 200, { reklamacja });
        return;
      }
      case "update":
      default: {
        const reklamacja = await transitionComplaintStatus({
          reklamacjaId,
          actor,
          nextStatus:
            actor.role === ROLE.ADMIN
              ? payload.status || undefined
              : REKLAMACJA_STATUS.UPDATED,
          action: "reklamacja_updated",
          patch: payload,
        });
        sendJson(res, 200, { reklamacja });
      }
    }
  } catch (error) {
    sendError(res, error);
  }
}

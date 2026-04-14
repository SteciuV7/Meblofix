import { REKLAMACJA_STATUS, ROLE } from "@/lib/constants";
import { requireApiUser } from "@/lib/server/auth";
import { requireMethod, sendError, sendJson } from "@/lib/server/http";
import {
  acceptComplaint,
  ensureComplaintManualStatusChangeAllowed,
  getReklamacjaDetail,
  manuallyChangeComplaintStatus,
  normalizeComplaintInfoPatch,
  setComplaintPickedUp,
  transitionComplaintStatus,
  validateComplaintClosePayload,
  validateOptionalComplaintClosePayload,
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
        const reklamacja = await acceptComplaint({ reklamacjaId, actor, payload });
        sendJson(res, 200, { reklamacja });
        return;
      }
      case "waiting-delivery": {
        requireAdmin(actor);
        await ensureComplaintManualStatusChangeAllowed({ reklamacjaId });
        const waitingDeliveryPayload =
          validateOptionalComplaintClosePayload(payload);
        const reklamacja = await transitionComplaintStatus({
          reklamacjaId,
          actor,
          nextStatus: REKLAMACJA_STATUS.WAITING_DELIVERY,
          action: "reklamacja_waiting_delivery",
          patch: {
            ...normalizeComplaintInfoPatch(payload),
            ...waitingDeliveryPayload,
            data_zakonczenia: null,
          },
        });
        sendJson(res, 200, { reklamacja });
        return;
      }
      case "close": {
        requireAdmin(actor);
        await ensureComplaintManualStatusChangeAllowed({ reklamacjaId });
        const closePayload = validateComplaintClosePayload(payload);
        const reklamacja = await transitionComplaintStatus({
          reklamacjaId,
          actor,
          nextStatus: REKLAMACJA_STATUS.DONE,
          action: "reklamacja_closed_manual",
          patch: {
            ...normalizeComplaintInfoPatch(payload),
            ...closePayload,
            data_zakonczenia: new Date().toISOString(),
          },
        });
        sendJson(res, 200, { reklamacja });
        return;
      }
      case "update-close-data": {
        requireAdmin(actor);
        const closePayload = validateComplaintClosePayload(payload);
        const reklamacja = await transitionComplaintStatus({
          reklamacjaId,
          actor,
          action: "reklamacja_close_data_updated",
          patch: {
            ...normalizeComplaintInfoPatch(payload),
            ...closePayload,
          },
        });
        sendJson(res, 200, { reklamacja });
        return;
      }
      case "manual-status-change": {
        requireAdmin(actor);
        const reklamacja = await manuallyChangeComplaintStatus({
          reklamacjaId,
          actor,
          nextStatus: payload.status,
          closePayload: payload.closePayload,
          waitingDeliveryPayload: payload.waitingDeliveryPayload,
        });
        sendJson(res, 200, { reklamacja });
        return;
      }
      case "set-element-odebrany": {
        requireAdmin(actor);
        const reklamacja = await setComplaintPickedUp({
          reklamacjaId,
          actor,
          elementOdebrany: payload.element_odebrany,
        });
        sendJson(res, 200, { reklamacja });
        return;
      }
      case "update":
      default: {
        const nextPayload = { ...payload };
        delete nextPayload.status;

        const reklamacja = await transitionComplaintStatus({
          reklamacjaId,
          actor,
          nextStatus:
            actor.role === ROLE.ADMIN ? undefined : REKLAMACJA_STATUS.UPDATED,
          action: "reklamacja_updated",
          patch: nextPayload,
          requireCustomerDataValidation: actor.role !== ROLE.ADMIN,
        });
        sendJson(res, 200, { reklamacja });
      }
    }
  } catch (error) {
    sendError(res, error);
  }
}

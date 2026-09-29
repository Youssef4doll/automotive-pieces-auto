import { RETURN_DAYS, WARRANTY_MONTHS } from "./policy";
import type { ReturnCover, ReturnReason, ReturnStatus, ReturnWish } from "./returns-rules";

/**
 * The French words for a return, shared by the website's pages, the admin
 * and the e-mails, so a request is called the same thing everywhere it is
 * seen. (The app carries its own three languages in its dictionaries.)
 */

/** In the customer's voice: what they tick. */
export const RETURN_REASON_LABEL: Record<ReturnReason, string> = {
  WRONG_PART: "Ce n'est pas la pièce commandée",
  DAMAGED: "Pièce abîmée à la livraison",
  DOES_NOT_FIT: "La pièce ne va pas sur mon véhicule",
  DEFECTIVE: "Pièce défectueuse (garantie)",
  NOT_NEEDED: "Je n'en ai plus besoin",
};

export const RETURN_WISH_LABEL: Record<ReturnWish, string> = {
  EXCHANGE: "Un échange",
  REFUND: "Un remboursement",
};

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: "Demande envoyée",
  APPROVED: "Acceptée",
  REFUSED: "Refusée",
  RECEIVED: "Pièce reçue",
  RESOLVED: "Terminée",
  CANCELLED: "Annulée",
};

export const RETURN_METHOD_LABEL = {
  DROP_OFF: "Dépôt au magasin",
  PICKUP: "Récupération par la boutique",
} as const;

export const RETURN_OUTCOME_LABEL = {
  EXCHANGED: "Pièce échangée",
  REFUNDED: "Remboursée",
} as const;

/** The policy's own sentence for each case — see lib/returns-rules. */
export const RETURN_COVER_LINE: Record<ReturnCover, string> = {
  shop: "L'erreur vient de nous : le retour et le remplacement sont à notre charge.",
  warranty: `Garantie ${WARRANTY_MONTHS} mois : la pièce est couverte contre les défauts de fabrication ; la main-d'œuvre de dépose et repose ne l'est pas.`,
  standard: `Retour sous ${RETURN_DAYS} jours : la pièce doit être non montée, non rayée, dans son emballage, avec ses accessoires.`,
};

/**
 * What a push notification says, in the language the phone registered in.
 *
 * Pure, so it is tested without a database or a network. Every sentence is a
 * fact about the order at that moment — the status the shop just set — and
 * never a promise about what comes next ("livrée demain"): the shop has not
 * said when, so neither does the notification.
 *
 * The order is named by what is in it ("Amortisseur avant SACHS + 1"), the
 * way the app lists orders, rather than by its CMD reference.
 */

export type PushLocale = "fr" | "en" | "ar";
export type PushStatus = "PENDING" | "CONFIRMED" | "PREPARED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export function pushLocale(raw: string | null | undefined): PushLocale {
  return raw === "en" || raw === "ar" ? raw : "fr";
}

/** "Amortisseur avant SACHS" or "Amortisseur avant SACHS + 2", cut to fit a lock screen. */
export function orderLabel(lead: string, more: number): string {
  const name = lead.length > 48 ? `${lead.slice(0, 47)}…` : lead;
  return more > 0 ? `${name} + ${more}` : name;
}

type Copy = { title: string; body: (label: string) => string };

const ORDER: Record<PushLocale, Partial<Record<PushStatus | "READY", Copy>>> = {
  fr: {
    CONFIRMED: { title: "Commande confirmée", body: (l) => `La boutique a confirmé votre commande : ${l}.` },
    READY: { title: "Commande prête", body: (l) => `Votre commande est prête au magasin : ${l}.` },
    SHIPPED: { title: "Commande en route", body: (l) => `Votre commande a été remise au livreur : ${l}.` },
    DELIVERED: { title: "Commande livrée", body: (l) => `Votre commande est marquée livrée : ${l}. Dites-nous comment ça s'est passé.` },
    CANCELLED: { title: "Commande annulée", body: (l) => `Votre commande a été annulée : ${l}.` },
  },
  en: {
    CONFIRMED: { title: "Order confirmed", body: (l) => `The shop confirmed your order: ${l}.` },
    READY: { title: "Order ready", body: (l) => `Your order is ready at the shop: ${l}.` },
    SHIPPED: { title: "Order on its way", body: (l) => `Your order was handed to the courier: ${l}.` },
    DELIVERED: { title: "Order delivered", body: (l) => `Your order is marked delivered: ${l}. Tell us how it went.` },
    CANCELLED: { title: "Order cancelled", body: (l) => `Your order was cancelled: ${l}.` },
  },
  ar: {
    CONFIRMED: { title: "تم تأكيد الطلب", body: (l) => `أكّد المتجر طلبك: ${l}.` },
    READY: { title: "الطلب جاهز", body: (l) => `طلبك جاهز في المتجر: ${l}.` },
    SHIPPED: { title: "الطلب في الطريق", body: (l) => `سُلّم طلبك لعامل التوصيل: ${l}.` },
    DELIVERED: { title: "تم تسليم الطلب", body: (l) => `طلبك مسجَّل كمُسلَّم: ${l}. أخبرنا كيف جرى الأمر.` },
    CANCELLED: { title: "أُلغي الطلب", body: (l) => `أُلغي طلبك: ${l}.` },
  },
};

/**
 * The notification for an order that just moved to `status`, or null when
 * that move is not worth waking a phone for. PREPARED only matters for a
 * pickup — it means "come and get it"; for a delivery the next useful news is
 * the van.
 */
export function orderStatusPush(
  status: PushStatus,
  locale: PushLocale,
  label: string,
  deliveryMethod: "DELIVERY" | "PICKUP",
): { title: string; body: string } | null {
  const key = status === "PREPARED" ? (deliveryMethod === "PICKUP" ? "READY" : null) : status;
  if (!key) return null;
  const copy = ORDER[locale][key];
  return copy ? { title: copy.title, body: copy.body(label) } : null;
}

const BACK: Record<PushLocale, { title: string; body: (name: string) => string }> = {
  fr: { title: "De retour en stock", body: (n) => `${n} est de nouveau disponible en magasin.` },
  en: { title: "Back in stock", body: (n) => `${n} is back on the shelf.` },
  ar: { title: "عادت إلى المخزون", body: (n) => `${n} متوفرة من جديد في المتجر.` },
};

export function backInStockPush(locale: PushLocale, name: string) {
  const c = BACK[locale];
  return { title: c.title, body: c.body(name.length > 60 ? `${name.slice(0, 59)}…` : name) };
}

/** Expo's token shape; anything else is refused before it is stored. */
export const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$/;

/**
 * A return request moved. Facts only: what the shop just did, and — once it
 * is settled — what it settled on, with the amount when it is a refund.
 */
export type ReturnPushStatus = "APPROVED" | "REFUSED" | "RECEIVED" | "RESOLVED";

const RETURN: Record<PushLocale, Record<ReturnPushStatus, { title: string; body: (ref: string) => string }>> = {
  fr: {
    APPROVED: { title: "Retour accepté", body: (r) => `La boutique a accepté votre demande ${r}. Ouvrez-la pour savoir comment rendre la pièce.` },
    REFUSED: { title: "Demande de retour refusée", body: (r) => `La boutique a répondu à votre demande ${r}. Ouvrez-la pour lire sa réponse.` },
    RECEIVED: { title: "Pièce reçue", body: (r) => `La boutique a reçu la pièce de votre demande ${r}.` },
    RESOLVED: { title: "Retour terminé", body: (r) => `Votre demande ${r} est réglée.` },
  },
  en: {
    APPROVED: { title: "Return accepted", body: (r) => `The shop accepted your request ${r}. Open it to see how to send the part back.` },
    REFUSED: { title: "Return request declined", body: (r) => `The shop answered your request ${r}. Open it to read the answer.` },
    RECEIVED: { title: "Part received", body: (r) => `The shop received the part from your request ${r}.` },
    RESOLVED: { title: "Return settled", body: (r) => `Your request ${r} is settled.` },
  },
  ar: {
    APPROVED: { title: "تم قبول الإرجاع", body: (r) => `قبل المتجر طلبك ${r}. افتحه لمعرفة كيفية إرجاع القطعة.` },
    REFUSED: { title: "رُفض طلب الإرجاع", body: (r) => `ردّ المتجر على طلبك ${r}. افتحه لقراءة الرد.` },
    RECEIVED: { title: "تم استلام القطعة", body: (r) => `استلم المتجر القطعة الخاصة بطلبك ${r}.` },
    RESOLVED: { title: "اكتمل الإرجاع", body: (r) => `تمت تسوية طلبك ${r}.` },
  },
};

export function returnStatusPush(status: ReturnPushStatus, locale: PushLocale, returnRef: string) {
  const c = RETURN[locale][status];
  return { title: c.title, body: c.body(returnRef) };
}

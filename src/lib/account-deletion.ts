import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Delete a customer's account — from the website's profile page or from the
 * app (`DELETE /api/v1/account`). One definition, so the two doors cannot
 * disagree about what "deleted" means.
 *
 * What goes: the person — name, e-mail, phone, password — and everything
 * hanging off them: app sessions, saved baskets, reset links and profile
 * history cascade; the link from analytics events and contact messages to
 * them is cut (the messages' own text stays, as it is the shop's inbox).
 *
 * What stays: the orders, detached from the account. They are the shop's
 * accounting records and an invoice has to be kept; they carry the delivery
 * details typed at checkout as a snapshot, which is the part the shop is
 * obliged to retain. The deletion page says so before it asks.
 *
 * The caller has already checked the password and that the account is not
 * the shop's own (an admin is refused: deleting the only admin would lock
 * the shop out of its back office).
 */
export async function deleteCustomerAccount(userId: string) {
  await prisma.$transaction([
    prisma.order.updateMany({ where: { userId }, data: { userId: null } }),
    prisma.analyticsEvent.updateMany({ where: { userId }, data: { userId: null } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}

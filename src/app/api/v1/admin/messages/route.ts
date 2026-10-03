import { prisma } from "@/lib/prisma";
import { ok, preflightWrite } from "../../_lib/respond";
import { ADMIN, asAdmin } from "../_lib/admin";

export const OPTIONS = preflightWrite;

/**
 * The shop's inbox, for the staff app: `?filter=new` (default) or `all`.
 * Questions from the app, photo requests and the website's contact form —
 * one list, unanswered first. 100 at a time; the website keeps the rest.
 */
export async function GET(request: Request) {
  return asAdmin(request, "messages GET", async () => {
    const all = new URL(request.url).searchParams.get("filter") === "all";
    const rows = await prisma.contactMessage.findMany({
      where: all ? {} : { status: "NEW" },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        name: true,
        phone: true,
        subject: true,
        body: true,
        status: true,
        orderRef: true,
        createdAt: true,
        reply: true,
        accessTokenHash: true,
        _count: { select: { photos: true } },
      },
    });
    const waiting = await prisma.contactMessage.count({ where: { status: "NEW" } });
    return ok(
      {
        waiting,
        messages: rows.map((m) => ({
          id: m.id,
          name: m.name,
          phone: m.phone,
          subject: m.subject,
          excerpt: m.body.length > 140 ? `${m.body.slice(0, 139)}…` : m.body,
          status: m.status,
          orderRef: m.orderRef,
          createdAt: m.createdAt.toISOString(),
          replied: Boolean(m.reply),
          /** Asked from the app: a written reply reaches the asker there. */
          inApp: Boolean(m.accessTokenHash),
          photoCount: m._count.photos,
        })),
      },
      ADMIN,
    );
  });
}

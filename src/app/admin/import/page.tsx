import { prisma } from "@/lib/prisma";
import ImportPanel, { type BatchRow } from "@/components/admin/ImportPanel";
import type { ParsedRow } from "@/lib/import/parse";

export const metadata = { title: "Import catalogue" };

export default async function ImportPage() {
  const rows = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const batches: BatchRow[] = rows.map((b) => {
    const payload = (b.payload as unknown as ParsedRow[]) ?? [];
    return {
      id: b.id,
      filename: b.filename,
      status: b.status,
      rowCount: b.rowCount,
      createdCount: b.createdCount,
      updatedCount: b.updatedCount,
      errorCount: b.errorCount,
      warningCount: Number((b.report as { warningCount?: number })?.warningCount ?? 0),
      createdAt: b.createdAt.toISOString(),
      // Only what the table renders travels to the client — a 20 000-row
      // payload would otherwise be serialised into the page.
      preview: payload.slice(0, 400).map((r) => ({
        line: r.line,
        sku: r.sku,
        name: r.name,
        category: r.category,
        priceSell: r.priceSell,
        stockQty: r.stockQty,
        refCount: (r.oem?.length ?? 0) + (r.aftermarket?.length ?? 0),
        errors: r.errors ?? [],
        warnings: r.warnings ?? [],
      })),
    };
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-navy-950">Import catalogue</h1>
        <p className="text-sm text-gray-500 mt-1">
          Chargez le fichier de votre fournisseur. Il est analysé, validé et présenté en aperçu avant d&apos;écrire quoi
          que ce soit — et un import appliqué peut être annulé.
        </p>
      </div>
      <ImportPanel batches={batches} />
    </div>
  );
}

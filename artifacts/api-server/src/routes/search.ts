import { Router, type IRouter } from "express";
import { ilike, or } from "drizzle-orm";
import { db, customersTable, partsTable } from "@workspace/db";
import { SearchQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function computeStatus(parts: { status: string }[]): "all_received" | "waiting" | "backordered" {
  if (parts.length === 0) return "waiting";
  if (parts.some((p) => p.status === "backordered")) return "backordered";
  if (parts.every((p) => p.status === "received")) return "all_received";
  return "waiting";
}

router.get("/search", async (req, res): Promise<void> => {
  const parsed = SearchQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const q = `%${parsed.data.q}%`;

  const customers = await db
    .select()
    .from(customersTable)
    .where(
      or(
        ilike(customersTable.name, q),
        ilike(customersTable.vehicleMake, q),
        ilike(customersTable.vehicleModel, q),
        ilike(customersTable.roNumber, q),
      ),
    )
    .orderBy(customersTable.name);

  const allParts = await db.select().from(partsTable);
  const partsByCustomer = new Map<number, typeof allParts>();
  for (const part of allParts) {
    const list = partsByCustomer.get(part.customerId) ?? [];
    list.push(part);
    partsByCustomer.set(part.customerId, list);
  }

  const result = customers.map((c) => {
    const parts = partsByCustomer.get(c.id) ?? [];
    const received = parts.filter((p) => p.status === "received").length;
    return {
      ...c,
      status: computeStatus(parts),
      partsTotal: parts.length,
      partsReceived: received,
    };
  });

  res.json(result);
});

export default router;

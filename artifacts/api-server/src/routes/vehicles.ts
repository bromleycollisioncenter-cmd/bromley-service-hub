import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, vehiclesTable, estimatesTable, estimatePartsTable, customersTable } from "@workspace/db";

const router: IRouter = Router();

// GET /vehicles
router.get("/vehicles", async (_req, res): Promise<void> => {
  const vehicles = await db.select().from(vehiclesTable).orderBy(vehiclesTable.updatedAt);

  const allParts = await db
    .select({ vehicleId: estimatePartsTable.vehicleId, ordered: estimatePartsTable.ordered, received: estimatePartsTable.received })
    .from(estimatePartsTable);

  const allCustomers = await db
    .select({ id: customersTable.id, name: customersTable.name })
    .from(customersTable);
  const customerMap = new Map(allCustomers.map((c) => [c.id, c.name]));

  // Build part counts per vehicle
  const partCounts = new Map<number, { total: number; ordered: number; received: number }>();
  for (const p of allParts) {
    const cur = partCounts.get(p.vehicleId) ?? { total: 0, ordered: 0, received: 0 };
    cur.total++;
    if (p.ordered) cur.ordered++;
    if (p.received) cur.received++;
    partCounts.set(p.vehicleId, cur);
  }

  const result = vehicles.reverse().map((v) => {
    const counts = partCounts.get(v.id) ?? { total: 0, ordered: 0, received: 0 };
    return {
      ...v,
      customerName: v.customerId ? (customerMap.get(v.customerId) ?? null) : null,
      partsTotal: counts.total,
      partsOrdered: counts.ordered,
      partsReceived: counts.received,
    };
  });

  res.json(result);
});

// GET /vehicles/:id
router.get("/vehicles/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, id));
  if (!vehicle) { res.status(404).json({ error: "Not found" }); return; }

  const [estimate] = await db.select().from(estimatesTable).where(eq(estimatesTable.vehicleId, id));
  const parts = await db
    .select()
    .from(estimatePartsTable)
    .where(eq(estimatePartsTable.vehicleId, id))
    .orderBy(estimatePartsTable.lineNumber);

  let customerName: string | null = null;
  let customerPhone: string | null = null;
  if (vehicle.customerId) {
    const [cust] = await db
      .select({ name: customersTable.name, phone: customersTable.phone })
      .from(customersTable)
      .where(eq(customersTable.id, vehicle.customerId));
    customerName = cust?.name ?? null;
    customerPhone = cust?.phone ?? null;
  }

  res.json({ ...vehicle, customerName, customerPhone, estimate: estimate ?? null, parts });
});

// PATCH /vehicles/:id
const VALID_STATUSES = ["waiting_on_parts", "in_repair", "ready", "complete", "delivered"] as const;
type VehicleStatus = typeof VALID_STATUSES[number];

router.patch("/vehicles/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = req.body as Partial<{
    status: VehicleStatus;
    jobNumber: string | null;
    insuranceCompany: string | null;
    claimNumber: string | null;
    policyNumber: string | null;
    estimator: string | null;
    mileage: string | null;
  }>;

  const setData: Partial<typeof vehiclesTable.$inferInsert> = { updatedAt: new Date() };
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) { res.status(400).json({ error: "Invalid status" }); return; }
    setData.status = body.status;
  }
  if ("jobNumber" in body) setData.jobNumber = body.jobNumber ?? null;
  if ("insuranceCompany" in body) setData.insuranceCompany = body.insuranceCompany ?? null;
  if ("claimNumber" in body) setData.claimNumber = body.claimNumber ?? null;
  if ("policyNumber" in body) setData.policyNumber = body.policyNumber ?? null;
  if ("estimator" in body) setData.estimator = body.estimator ?? null;
  if ("mileage" in body) setData.mileage = body.mileage ?? null;

  const [updated] = await db
    .update(vehiclesTable)
    .set(setData)
    .where(eq(vehiclesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// PATCH /estimate-parts/:id
router.patch("/estimate-parts/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = req.body as Partial<{ ordered: boolean; received: boolean; installed: boolean }>;
  const setData: Partial<typeof estimatePartsTable.$inferInsert> = { updatedAt: new Date() };
  if (body.ordered !== undefined) setData.ordered = Boolean(body.ordered);
  if (body.received !== undefined) setData.received = Boolean(body.received);
  if (body.installed !== undefined) setData.installed = Boolean(body.installed);

  const [updated] = await db
    .update(estimatePartsTable)
    .set(setData)
    .where(eq(estimatePartsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  await db
    .update(vehiclesTable)
    .set({ updatedAt: new Date() })
    .where(eq(vehiclesTable.id, updated.vehicleId));

  res.json(updated);
});

export default router;

import { Router, type IRouter } from "express";
import { eq, ilike, or, desc, sql } from "drizzle-orm";
import { db, customersTable, partsTable } from "@workspace/db";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  GetCustomerParams,
  UpdateCustomerParams,
  DeleteCustomerParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Compute customer status from parts
function computeStatus(parts: { status: string }[]): "all_received" | "waiting" | "backordered" {
  if (parts.length === 0) return "waiting";
  if (parts.some((p) => p.status === "backordered")) return "backordered";
  if (parts.every((p) => p.status === "received")) return "all_received";
  return "waiting";
}

router.get("/customers", async (req, res): Promise<void> => {
  const customers = await db.select().from(customersTable).orderBy(customersTable.name);

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

router.post("/customers", async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [customer] = await db
    .insert(customersTable)
    .values({
      name: parsed.data.name,
      vehicleYear: parsed.data.vehicleYear ?? null,
      vehicleMake: parsed.data.vehicleMake ?? null,
      vehicleModel: parsed.data.vehicleModel ?? null,
      roNumber: parsed.data.roNumber ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  res.status(201).json({ ...customer, status: "waiting", partsTotal: 0, partsReceived: 0 });
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetCustomerParams.safeParse({ id: parseInt(raw, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, parsed.data.id));
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const parts = await db
    .select()
    .from(partsTable)
    .where(eq(partsTable.customerId, parsed.data.id))
    .orderBy(partsTable.createdAt);

  const received = parts.filter((p) => p.status === "received").length;

  res.json({
    ...customer,
    status: computeStatus(parts),
    partsTotal: parts.length,
    partsReceived: received,
    parts,
  });
});

router.patch("/customers/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramsParsed = UpdateCustomerParams.safeParse({ id: parseInt(rawId, 10) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const bodyParsed = UpdateCustomerBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const updates: Partial<typeof customersTable.$inferInsert> = {};
  const d = bodyParsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if (d.vehicleYear !== undefined) updates.vehicleYear = d.vehicleYear;
  if (d.vehicleMake !== undefined) updates.vehicleMake = d.vehicleMake;
  if (d.vehicleModel !== undefined) updates.vehicleModel = d.vehicleModel;
  if (d.roNumber !== undefined) updates.roNumber = d.roNumber;
  if (d.notes !== undefined) updates.notes = d.notes;

  const [updated] = await db
    .update(customersTable)
    .set(updates)
    .where(eq(customersTable.id, paramsParsed.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const parts = await db.select().from(partsTable).where(eq(partsTable.customerId, updated.id));
  const received = parts.filter((p) => p.status === "received").length;

  res.json({ ...updated, status: computeStatus(parts), partsTotal: parts.length, partsReceived: received });
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = DeleteCustomerParams.safeParse({ id: parseInt(raw, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [deleted] = await db
    .delete(customersTable)
    .where(eq(customersTable.id, parsed.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.status(204).send();
});

export default router;

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, partsTable, customersTable } from "@workspace/db";
import {
  AddPartParams,
  AddPartBody,
  UpdatePartParams,
  UpdatePartBody,
  DeletePartParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/customers/:customerId/parts", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.customerId) ? req.params.customerId[0] : req.params.customerId;
  const paramsParsed = AddPartParams.safeParse({ customerId: parseInt(raw, 10) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid customerId" });
    return;
  }

  const bodyParsed = AddPartBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  // Check customer exists
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, paramsParsed.data.customerId));
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const [part] = await db
    .insert(partsTable)
    .values({
      customerId: paramsParsed.data.customerId,
      name: bodyParsed.data.name,
      status: bodyParsed.data.status ?? "waiting",
    })
    .returning();

  // Bump customer updatedAt
  await db
    .update(customersTable)
    .set({ updatedAt: new Date() })
    .where(eq(customersTable.id, paramsParsed.data.customerId));

  res.status(201).json(part);
});

router.patch("/parts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramsParsed = UpdatePartParams.safeParse({ id: parseInt(raw, 10) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const bodyParsed = UpdatePartBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const updates: Partial<typeof partsTable.$inferInsert> = {};
  if (bodyParsed.data.name !== undefined) updates.name = bodyParsed.data.name;
  if (bodyParsed.data.status !== undefined) updates.status = bodyParsed.data.status;

  const [updated] = await db
    .update(partsTable)
    .set(updates)
    .where(eq(partsTable.id, paramsParsed.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Part not found" });
    return;
  }

  // Bump customer updatedAt
  await db
    .update(customersTable)
    .set({ updatedAt: new Date() })
    .where(eq(customersTable.id, updated.customerId));

  res.json(updated);
});

router.delete("/parts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = DeletePartParams.safeParse({ id: parseInt(raw, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [deleted] = await db
    .delete(partsTable)
    .where(eq(partsTable.id, parsed.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Part not found" });
    return;
  }

  res.status(204).send();
});

export default router;

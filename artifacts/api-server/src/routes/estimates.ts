import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, ilike } from "drizzle-orm";
import { db, customersTable, vehiclesTable, estimatesTable, estimatePartsTable } from "@workspace/db";
import { parseCccEstimate } from "../lib/parseCccEstimate.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

router.post("/estimates/upload", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  let parsed;
  try {
    parsed = await parseCccEstimate(req.file.buffer);
  } catch (err) {
    console.error("PDF parse error:", err);
    res.status(400).json({ error: "Failed to parse PDF. Make sure it is a CCC ONE estimate." });
    return;
  }

  try {
    // ── 1. Upsert customer (outside transaction — idempotent, low risk) ──────
    let customerId: number | null = null;
    if (parsed.customerName) {
      const normalizedName = parsed.customerName.trim();
      const existing = await db
        .select()
        .from(customersTable)
        .where(ilike(customersTable.name, normalizedName))
        .limit(1);

      if (existing.length > 0) {
        const cust = existing[0];
        const updates: Partial<typeof customersTable.$inferInsert> = {};
        if (parsed.phone && !cust.phone) updates.phone = parsed.phone;
        if (parsed.insuranceCompany && !cust.insuranceCompany) updates.insuranceCompany = parsed.insuranceCompany;
        if (parsed.claimNumber && !cust.claimNumber) updates.claimNumber = parsed.claimNumber;
        if (Object.keys(updates).length) {
          await db
            .update(customersTable)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(customersTable.id, cust.id));
        }
        customerId = cust.id;
      } else {
        const [newCust] = await db
          .insert(customersTable)
          .values({
            name: normalizedName,
            phone: parsed.phone,
            insuranceCompany: parsed.insuranceCompany,
            claimNumber: parsed.claimNumber,
          })
          .returning();
        customerId = newCust.id;
      }
    }

    // ── 2–4. Vehicle + Estimate + Parts in a single transaction ──────────────
    const { vehicle, estimate, partsImported } = await db.transaction(async (tx) => {
      // Vehicle — use grandTotal as the authoritative estimate total
      const [vehicle] = await tx
        .insert(vehiclesTable)
        .values({
          workfileId: parsed.workfileId,
          jobNumber: parsed.jobNumber,
          customerId,
          year: parsed.year,
          make: parsed.make,
          model: parsed.model,
          trim: parsed.trim,
          vin: parsed.vin,
          color: parsed.color,
          mileage: parsed.mileage,
          insuranceCompany: parsed.insuranceCompany,
          claimNumber: parsed.claimNumber,
          policyNumber: parsed.policyNumber,
          dateOfLoss: parsed.dateOfLoss,
          estimator: parsed.estimator,
          status: "waiting_on_parts",
          estimateTotal: parsed.grandTotal?.toString() ?? null,
          insurancePay: parsed.insurancePay?.toString() ?? null,
          customerPay: parsed.customerPay?.toString() ?? null,
          deductible: parsed.deductible?.toString() ?? null,
        })
        .returning();

      // Estimate document
      const [estimate] = await tx
        .insert(estimatesTable)
        .values({
          vehicleId: vehicle.id,
          workfileId: parsed.workfileId,
          jobNumber: parsed.jobNumber,
          estimateDate: parsed.estimateDate,
          pdfFilename: req.file!.originalname,
          totalAmount: parsed.partsSubtotal?.toString() ?? null,
          bodyLaborHours: parsed.bodyLaborHours?.toString() ?? null,
          paintLaborHours: parsed.paintLaborHours?.toString() ?? null,
          paintSupplies: parsed.paintSupplies?.toString() ?? null,
          bodySupplies: parsed.bodySupplies?.toString() ?? null,
          miscellaneous: parsed.miscellaneous?.toString() ?? null,
          tax: parsed.tax?.toString() ?? null,
          grandTotal: parsed.grandTotal?.toString() ?? null,
          deductible: parsed.deductible?.toString() ?? null,
          customerPay: parsed.customerPay?.toString() ?? null,
          insurancePay: parsed.insurancePay?.toString() ?? null,
        })
        .returning();

      // Parts
      let partsImported = 0;
      if (parsed.lineItems.length > 0) {
        await tx.insert(estimatePartsTable).values(
          parsed.lineItems.map((item) => ({
            vehicleId: vehicle.id,
            estimateId: estimate.id,
            lineNumber: item.lineNumber,
            operation: item.operation,
            description: item.description,
            partNumber: item.partNumber,
            quantity: item.quantity?.toString() ?? null,
            price: item.price?.toString() ?? null,
            laborHours: item.laborHours?.toString() ?? null,
            paintHours: item.paintHours?.toString() ?? null,
            ordered: false,
            received: false,
            installed: false,
          })),
        );
        partsImported = parsed.lineItems.length;
      }

      return { vehicle, estimate, partsImported };
    });

    res.json({ vehicleId: vehicle.id, partsImported, parsed });
  } catch (err) {
    console.error("DB write error during estimate upload:", err);
    res.status(500).json({ error: "Failed to save estimate data. Please try again." });
  }
});

export default router;

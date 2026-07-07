import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { eq, and, ilike } from "drizzle-orm";
import { db, customersTable, partsTable } from "@workspace/db";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Flexible column name resolver — case-insensitive, trims spaces
function findCol(headers: string[], candidates: string[]): string | undefined {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

function parseReceived(val: unknown): boolean {
  if (val === null || val === undefined || val === "") return false;
  const s = String(val).toLowerCase().trim();
  return s === "yes" || s === "y" || s === "true" || s === "1" || s === "received";
}

router.post(
  "/import",
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    } catch {
      res.status(400).json({ error: "Could not read Excel file. Make sure it is a valid .xlsx file." });
      return;
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    if (rows.length === 0) {
      res.status(400).json({ error: "Spreadsheet appears to be empty." });
      return;
    }

    const headers = Object.keys(rows[0]);

    const colCustomer = findCol(headers, ["customer name", "customer", "name", "client name", "client"]);
    const colPartNum = findCol(headers, ["part number", "part #", "part no", "part no.", "partno", "part_number"]);
    const colPartDesc = findCol(headers, ["part description", "description", "part desc", "part name", "part"]);
    const colVendor = findCol(headers, ["vendor", "supplier", "source", "vendor name"]);
    const colDateOrdered = findCol(headers, ["date ordered", "order date", "ordered", "date", "ordered date"]);
    const colReceived = findCol(headers, ["received", "received?", "received (y/n)", "received y/n", "rcvd", "in stock", "arrived"]);
    const colVehicle = findCol(headers, ["vehicle make and model", "vehicle", "make and model", "make/model", "vehicle make/model", "car", "make & model"]);

    if (!colCustomer) {
      res.status(400).json({ error: "Could not find a customer name column. Expected a column named 'Customer Name'." });
      return;
    }
    if (!colPartDesc) {
      res.status(400).json({ error: "Could not find a part description column. Expected a column named 'Part Description'." });
      return;
    }

    const errors: string[] = [];
    let customersCreated = 0;
    let customersUpdated = 0;
    let partsCreated = 0;
    let partsUpdated = 0;
    let partsSkipped = 0;

    // Cache customers by lowercase name to avoid repeated DB hits
    const customerCache = new Map<string, number>(); // name.lower -> id

    // Preload existing customers
    const existingCustomers = await db.select().from(customersTable);
    for (const c of existingCustomers) {
      customerCache.set(c.name.toLowerCase().trim(), c.id);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed + header row

      const customerName = String(row[colCustomer] ?? "").trim();
      const partDesc = String(row[colPartDesc] ?? "").trim();

      if (!customerName || !partDesc) {
        partsSkipped++;
        continue;
      }

      const partNumber = colPartNum ? String(row[colPartNum] ?? "").trim() || null : null;
      const vendor = colVendor ? String(row[colVendor] ?? "").trim() || null : null;
      const dateOrdered = colDateOrdered
        ? (() => {
            const v = row[colDateOrdered];
            if (v instanceof Date) return v.toISOString().split("T")[0];
            const s = String(v ?? "").trim();
            return s || null;
          })()
        : null;
      const vehicle = colVehicle ? String(row[colVehicle] ?? "").trim() || null : null;
      const isReceived = colReceived ? parseReceived(row[colReceived]) : false;
      const status: "received" | "waiting" = isReceived ? "received" : "waiting";

      // Upsert customer
      const nameKey = customerName.toLowerCase();
      let customerId = customerCache.get(nameKey);

      if (customerId === undefined) {
        try {
          const [newCustomer] = await db
            .insert(customersTable)
            .values({ name: customerName, vehicleMake: vehicle })
            .returning();
          customerId = newCustomer.id;
          customerCache.set(nameKey, customerId);
          customersCreated++;
        } catch (err) {
          errors.push(`Row ${rowNum}: Failed to create customer "${customerName}"`);
          continue;
        }
      } else {
        // Update vehicle if we now have it and didn't before
        if (vehicle) {
          await db
            .update(customersTable)
            .set({ vehicleMake: vehicle, updatedAt: new Date() })
            .where(eq(customersTable.id, customerId));
          customersUpdated++;
        }
      }

      // Upsert part — dedup key: (customerId + partNumber) if partNumber exists,
      // otherwise (customerId + partDesc)
      try {
        const existingParts = await db
          .select()
          .from(partsTable)
          .where(eq(partsTable.customerId, customerId));

        let existingPart = partNumber
          ? existingParts.find((p) => p.partNumber?.toLowerCase() === partNumber.toLowerCase())
          : existingParts.find((p) => p.name.toLowerCase() === partDesc.toLowerCase());

        if (existingPart) {
          // Update if status changed or new info available
          const needsUpdate =
            existingPart.status !== status ||
            (vendor && existingPart.vendor !== vendor) ||
            (dateOrdered && existingPart.dateOrdered !== dateOrdered) ||
            (partNumber && existingPart.partNumber !== partNumber);

          if (needsUpdate) {
            await db
              .update(partsTable)
              .set({
                status,
                vendor: vendor ?? existingPart.vendor,
                dateOrdered: dateOrdered ?? existingPart.dateOrdered,
                partNumber: partNumber ?? existingPart.partNumber,
              })
              .where(eq(partsTable.id, existingPart.id));
            partsUpdated++;
          } else {
            partsSkipped++;
          }
        } else {
          await db.insert(partsTable).values({
            customerId,
            name: partDesc,
            partNumber,
            vendor,
            dateOrdered,
            status,
          });
          partsCreated++;
        }

        // Bump customer updatedAt
        await db
          .update(customersTable)
          .set({ updatedAt: new Date() })
          .where(eq(customersTable.id, customerId));
      } catch (err) {
        errors.push(`Row ${rowNum}: Failed to upsert part "${partDesc}" for "${customerName}"`);
      }
    }

    res.json({ customersCreated, customersUpdated, partsCreated, partsUpdated, partsSkipped, errors });
  },
);

export default router;

import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { vehiclesTable } from "./vehicles";

export const estimatesTable = pgTable("estimates", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id, { onDelete: "cascade" }),
  workfileId: text("workfile_id"),
  jobNumber: text("job_number"),
  estimateDate: text("estimate_date"),
  pdfFilename: text("pdf_filename"),
  totalAmount: numeric("total_amount"),
  bodyLaborHours: numeric("body_labor_hours"),
  paintLaborHours: numeric("paint_labor_hours"),
  paintSupplies: numeric("paint_supplies"),
  bodySupplies: numeric("body_supplies"),
  miscellaneous: numeric("miscellaneous"),
  tax: numeric("tax"),
  grandTotal: numeric("grand_total"),
  deductible: numeric("deductible"),
  customerPay: numeric("customer_pay"),
  insurancePay: numeric("insurance_pay"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Estimate = typeof estimatesTable.$inferSelect;

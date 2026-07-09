import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const vehiclesTable = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  workfileId: text("workfile_id"),
  jobNumber: text("job_number"),
  customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  year: integer("year"),
  make: text("make"),
  model: text("model"),
  trim: text("trim"),
  vin: text("vin"),
  color: text("color"),
  mileage: text("mileage"),
  insuranceCompany: text("insurance_company"),
  claimNumber: text("claim_number"),
  policyNumber: text("policy_number"),
  dateOfLoss: text("date_of_loss"),
  estimator: text("estimator"),
  status: text("status", {
    enum: ["waiting_on_parts", "in_repair", "ready", "complete", "delivered"],
  }).notNull().default("waiting_on_parts"),
  estimateTotal: numeric("estimate_total"),
  insurancePay: numeric("insurance_pay"),
  customerPay: numeric("customer_pay"),
  deductible: numeric("deductible"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Vehicle = typeof vehiclesTable.$inferSelect;

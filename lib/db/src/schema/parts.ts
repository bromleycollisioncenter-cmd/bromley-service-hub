import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";

export const partsTable = pgTable("parts", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  partNumber: text("part_number"),
  vendor: text("vendor"),
  dateOrdered: text("date_ordered"),
  status: text("status", { enum: ["received", "waiting", "backordered"] }).notNull().default("waiting"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPartSchema = createInsertSchema(partsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPart = z.infer<typeof insertPartSchema>;
export type Part = typeof partsTable.$inferSelect;

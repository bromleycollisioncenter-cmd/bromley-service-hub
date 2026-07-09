import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { vehiclesTable } from "./vehicles";
import { estimatesTable } from "./estimates";

export const estimatePartsTable = pgTable("estimate_parts", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id, { onDelete: "cascade" }),
  estimateId: integer("estimate_id").notNull().references(() => estimatesTable.id, { onDelete: "cascade" }),
  lineNumber: integer("line_number"),
  operation: text("operation"),
  description: text("description").notNull(),
  partNumber: text("part_number"),
  quantity: numeric("quantity"),
  price: numeric("price"),
  laborHours: numeric("labor_hours"),
  paintHours: numeric("paint_hours"),
  ordered: boolean("ordered").notNull().default(false),
  received: boolean("received").notNull().default(false),
  installed: boolean("installed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type EstimatePart = typeof estimatePartsTable.$inferSelect;

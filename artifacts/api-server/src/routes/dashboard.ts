import { Router, type IRouter } from "express";
import { eq, gte, and } from "drizzle-orm";
import { db, customersTable, partsTable } from "@workspace/db";

const router: IRouter = Router();

function computeStatus(parts: { status: string }[]): "all_received" | "waiting" | "backordered" {
  if (parts.length === 0) return "waiting";
  if (parts.some((p) => p.status === "backordered")) return "backordered";
  if (parts.every((p) => p.status === "received")) return "all_received";
  return "waiting";
}

router.get("/dashboard", async (req, res): Promise<void> => {
  const customers = await db.select().from(customersTable).orderBy(customersTable.updatedAt);
  const allParts = await db.select().from(partsTable);

  const partsByCustomer = new Map<number, typeof allParts>();
  for (const part of allParts) {
    const list = partsByCustomer.get(part.customerId) ?? [];
    list.push(part);
    partsByCustomer.set(part.customerId, list);
  }

  // Today's midnight UTC
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let partsReceivedToday = 0;
  for (const part of allParts) {
    if (part.status === "received" && part.updatedAt >= todayStart) {
      partsReceivedToday++;
    }
  }

  let waitingOnParts = 0;
  let jobsReady = 0;

  const customersWithStatus = customers.map((c) => {
    const parts = partsByCustomer.get(c.id) ?? [];
    const received = parts.filter((p) => p.status === "received").length;
    const status = computeStatus(parts);
    if (status === "waiting" || status === "backordered") waitingOnParts++;
    if (status === "all_received") jobsReady++;
    return {
      ...c,
      status,
      partsTotal: parts.length,
      partsReceived: received,
    };
  });

  // Recently updated — last 5, sorted by updatedAt desc
  const recentlyUpdated = [...customersWithStatus]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 5);

  res.json({
    openCustomers: customers.length,
    partsReceivedToday,
    customersWaitingOnParts: waitingOnParts,
    jobsReadyToComplete: jobsReady,
    recentlyUpdated,
  });
});

export default router;

// app/api/cron/update-feed/route.ts
import { db } from "@/db";
import { cycles, farmer } from "@/db/schema";
import { updateCycleFeed } from "@/modules/cycles/server/services/feed-service";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    // Optional: Allow filtering updates by officer (userId) if needed
    const targetUserId = searchParams.get("userId");

    // We want to find active cycles. 
    // If a userId is provided, we filter for farmers managed by that officer.
    const whereClause = targetUserId
      ? and(eq(cycles.status, "active"), eq(farmer.officerId, targetUserId))
      : eq(cycles.status, "active");

    const activeCycles = await db.select({
      cycle: cycles,
      officerId: farmer.officerId
    })
      .from(cycles)
      .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
      .where(whereClause);

    const results = await Promise.all(
      activeCycles.map(async ({ cycle, officerId }) => {
        // We use the officerId as the "user" performing the update for the log
        return await updateCycleFeed(cycle, officerId);
      })
    );

    const validUpdates = results.filter(r => r !== null);

    return NextResponse.json({
      success: true,
      count: validUpdates.length,
      updates: validUpdates
    });

  } catch (error) {
    console.error("Cron Job Failed:", error);
    return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
  }
}
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listForMe = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const limit = Math.max(1, Math.min(args.limit ?? 20, 100));

    return await ctx.db
      .query("notifications")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const markRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const notif = await ctx.db.get(args.notificationId);
    if (!notif) throw new Error("Not found");
    if (notif.userId !== userId) throw new Error("Not allowed");

    await ctx.db.patch(args.notificationId, { read: true });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const batch = await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(200);

    for (const n of batch) {
      if (!n.read) await ctx.db.patch(n._id, { read: true });
    }
  },
});

export type NotificationType =
  | "bidAccepted"
  | "bidRejected"
  | "bidWithdrawn"
  | "bidCancelled"
  | "bidClosed"
  | "jobDeleted"
  | "deliveryCode"
  | "cancelCode"
  | "cancelApproved"
  | "info";

export async function addNotification(
  ctx: any,
  params: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    jobId?: string;
  },
) {
  await ctx.db.insert("notifications", {
    userId: params.userId as any,
    type: params.type,
    title: params.title,
    body: params.body,
    jobId: params.jobId as any,
    createdAt: Date.now(),
    read: false,
  });
}

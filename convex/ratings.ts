import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const submitRating = mutation({
  args: {
    jobId: v.id("jobs"),
    toUserId: v.id("users"),
    score: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const fromUserId = await getAuthUserId(ctx);
    if (!fromUserId) throw new Error("Not authenticated");

    if (args.score < 1 || args.score > 5) throw new Error("Score must be 1-5");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (!job.confirmedAt && job.status !== "delivered") {
      throw new Error("Delivery not confirmed yet");
    }

    const isParticipant =
      job.senderId === fromUserId || job.takerId === fromUserId;
    if (!isParticipant) throw new Error("Not allowed");

    const already = await ctx.db
      .query("ratings")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .filter((q) =>
        q.and(
          q.eq(q.field("fromUserId"), fromUserId),
          q.eq(q.field("toUserId"), args.toUserId),
        ),
      )
      .first();

    if (already) throw new Error("You already rated this user for this job");

    await ctx.db.insert("ratings", {
      jobId: args.jobId,
      fromUserId,
      toUserId: args.toUserId,
      score: args.score,
      comment: args.comment,
    });

    // Recompute reputation (simple MVP approach).
    const all = await ctx.db
      .query("ratings")
      .withIndex("by_toUserId", (q) => q.eq("toUserId", args.toUserId))
      .collect();

    const avg =
      all.length === 0
        ? 0
        : all.reduce((sum, r) => sum + r.score, 0) / all.length;

    await ctx.db.patch(args.toUserId, { rating: avg });

    return { rating: avg };
  },
});

export const listForJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ratings")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();
  },
});

export const listForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_toUserId", (q) => q.eq("toUserId", args.userId))
      .order("desc")
      .collect();

    return await Promise.all(
      ratings.map(async (r) => {
        const fromUser = await ctx.db.get(r.fromUserId);
        return {
          ...r,
          fromUser: fromUser ? { name: fromUser.name, avatar: fromUser.avatar } : null,
        };
      })
    );
  },
});

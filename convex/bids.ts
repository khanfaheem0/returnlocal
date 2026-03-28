import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { addNotification } from "./notifications";

export const createBid = mutation({
  args: {
    jobId: v.id("jobs"),
    message: v.optional(v.string()),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const takerId = await getAuthUserId(ctx);
    if (!takerId) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.status !== "open") throw new Error("Job is not open");
    if (job.senderId === takerId) throw new Error("Cannot bid on your own job");

    const existingPending = await ctx.db
      .query("bids")
      .withIndex("by_jobId_status", (q) => q.eq("jobId", args.jobId).eq("status", "pending"))
      .filter((q) => q.eq(q.field("takerId"), takerId))
      .first();

    if (existingPending) throw new Error("You already have a pending bid on this job");

    const bidId = await ctx.db.insert("bids", {
      jobId: args.jobId,
      takerId,
      message: args.message,
      amount: args.amount,
      status: "pending",
    });

    await addNotification(ctx, {
      userId: job.senderId,
      type: "info",
      title: "New bid received",
      body: `A new bid was placed on ${job.title}`,
      jobId: args.jobId,
    });

    return bidId;
  },
});

export const listBidsForJob = query({
  args: {
    jobId: v.id("jobs"),
    showAll: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.senderId !== userId) throw new Error("Not allowed");

    const bids = await ctx.db
      .query("bids")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();

    // Once a bid is accepted (job assigned), only show that accepted bidder to the poster.
    const visibleBids =
      job.status === "assigned"
        ? bids.filter((b) => b.status === "accepted")
        : bids.filter((b) => b.status === "pending" || b.status === "accepted");

    const takers = await Promise.all(
      visibleBids.map(async (bid) => ({ bid, taker: await ctx.db.get(bid.takerId) })),
    );

    const statsCache = new Map<string, { jobsPostedTotal: number; jobsPostedDone: number }>();

    return (
      await Promise.all(
        takers.map(async ({ bid, taker }) => {
          if (!taker) return null;

          if (!statsCache.has(taker._id)) {
            const posted = await ctx.db
              .query("jobs")
              .withIndex("by_senderId", (q) => q.eq("senderId", taker._id))
              .collect();
            const postedDone = posted.filter((j) => j.confirmedAt).length;
            statsCache.set(taker._id, {
              jobsPostedTotal: posted.length,
              jobsPostedDone: postedDone,
            });
          }

          const stats = statsCache.get(taker._id)!;

          return {
            bid,
            taker,
            stats: {
              jobsDone: taker.completedJobs ?? 0,
              jobsPostedDone: stats.jobsPostedDone,
              jobsPostedTotal: stats.jobsPostedTotal,
              joinedAt: taker.createdAt ?? taker._creationTime,
            },
          };
        }),
      )
    ).filter(Boolean);
  },
});

export const acceptBid = mutation({
  args: {
    bidId: v.id("bids"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const bid = await ctx.db.get(args.bidId);
    if (!bid) throw new Error("Bid not found");

    const job = await ctx.db.get(bid.jobId);
    if (!job) throw new Error("Job not found");
    if (job.senderId !== userId) throw new Error("Not allowed");
    if (job.status !== "open") throw new Error("Job not open");

    const taker = await ctx.db.get(bid.takerId);
    const takerRating = taker?.rating ?? 0;
    const takerVerified = taker?.verified ?? false;

    if ((args.force ?? false) === false && takerRating < 3 && !takerVerified) {
      return {
        ok: false,
        requiresConfirmation: true,
        message:
          "This could be a trap: the taker has low rating and is not ID-verified. Only proceed if you trust this taker.",
      } as const;
    }

    await ctx.db.patch(args.bidId, { status: "accepted" });

    const otherBids = await ctx.db
      .query("bids")
      .withIndex("by_jobId", (q) => q.eq("jobId", bid.jobId))
      .collect();

    for (const other of otherBids) {
      if (other._id === args.bidId) continue;
      if (other.status === "pending" || other.status === "accepted") {
        await ctx.db.patch(other._id, { status: "rejected" });
        await addNotification(ctx, {
          userId: other.takerId,
          type: "bidClosed",
          title: "Bid not accepted",
          body: `${job.title} was assigned to another taker.`,
          jobId: job._id,
        });
      }
    }

    await ctx.db.patch(job._id, {
      status: "assigned",
      takerId: bid.takerId,
    });

    await addNotification(ctx, {
      userId: bid.takerId,
      type: "bidAccepted",
      title: "Bid accepted",
      body: `Your bid on ${job.title} was accepted.`,
      jobId: job._id,
    });

    return { ok: true } as const;
  },
});

export const rejectBid = mutation({
  args: {
    bidId: v.id("bids"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const bid = await ctx.db.get(args.bidId);
    if (!bid) throw new Error("Bid not found");
    if (bid.status !== "pending") throw new Error("Bid is not pending");

    const job = await ctx.db.get(bid.jobId);
    if (!job) throw new Error("Job not found");
    if (job.senderId !== userId) throw new Error("Not allowed");

    await ctx.db.patch(args.bidId, { status: "rejected" });

    await addNotification(ctx, {
      userId: bid.takerId,
      type: "bidRejected",
      title: "Bid rejected",
      body: `Your bid on ${job.title} was rejected.`,
      jobId: bid.jobId,
    });
  },
});

export const withdrawBid = mutation({
  args: {
    bidId: v.id("bids"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const bid = await ctx.db.get(args.bidId);
    if (!bid) throw new Error("Bid not found");
    if (bid.takerId !== userId) throw new Error("Not allowed");
    if (bid.status !== "pending") throw new Error("Only pending bids can be withdrawn");

    await ctx.db.patch(args.bidId, { status: "withdrawn" });

    const job = await ctx.db.get(bid.jobId);
    if (job) {
      await addNotification(ctx, {
        userId: job.senderId,
        type: "bidWithdrawn",
        title: "Bid withdrawn",
        body: `A bidder withdrew their request on ${job.title}.`,
        jobId: bid.jobId,
      });
    }
  },
});

export const listMyPendingBids = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const bids = await ctx.db
      .query("bids")
      .withIndex("by_takerId", (q) => q.eq("takerId", userId))
      .collect();

    const pending = bids.filter((b) => b.status === "pending");

    const jobs = await Promise.all(
      pending.map(async (b) => ({ bid: b, job: await ctx.db.get(b.jobId) })),
    );

    return jobs.filter((j) => Boolean(j.job));
  },
});

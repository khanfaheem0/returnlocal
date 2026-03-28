import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { addNotification } from "./notifications";

export const listForJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("handoffs")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();
  },
});

export const submitPickupProof = mutation({
  args: {
    jobId: v.id("jobs"),
    storageId: v.id("_storage"),
    gpsLat: v.number(),
    gpsLng: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.takerId !== userId) throw new Error("Not allowed");
    if (job.status !== "assigned") throw new Error("Job not assigned");

    const photoUrl = await ctx.storage.getUrl(args.storageId);
    if (!photoUrl) throw new Error("Upload not found");

    await ctx.db.insert("handoffs", {
      jobId: args.jobId,
      photoUrl,
      gpsLat: args.gpsLat,
      gpsLng: args.gpsLng,
      timestamp: Date.now(),
      type: "pickup",
    });

    await ctx.db.patch(args.jobId, { status: "picked" });
  },
});

export const submitDropoffProof = mutation({
  args: {
    jobId: v.id("jobs"),
    storageId: v.id("_storage"),
    gpsLat: v.number(),
    gpsLng: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.takerId !== userId) throw new Error("Not allowed");
    if (job.status !== "picked") throw new Error("Pickup proof required first");

    const photoUrl = await ctx.storage.getUrl(args.storageId);
    if (!photoUrl) throw new Error("Upload not found");

    await ctx.db.insert("handoffs", {
      jobId: args.jobId,
      photoUrl,
      gpsLat: args.gpsLat,
      gpsLng: args.gpsLng,
      timestamp: Date.now(),
      type: "dropoff",
    });

    await ctx.db.patch(args.jobId, { status: "delivered" });

    await ctx.runMutation(api.jobs.scheduleAutoConfirm, { jobId: args.jobId });

    // Notify sender that item is delivered
    await addNotification(ctx, {
      userId: job.senderId,
      type: "info",
      title: "Item delivered",
      body: `${job.title} was marked delivered.`,
      jobId: job._id,
    });
  },
});

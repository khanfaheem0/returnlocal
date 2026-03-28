import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { addNotification } from "./notifications";

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function clampRadiusKm(radiusKm: number) {
  return Math.max(10, Math.min(50, radiusKm));
}

export const createJob = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    pickupAddress: v.string(),
    lat: v.number(),
    lng: v.number(),
    dropAddress: v.string(),
    dropLat: v.number(),
    dropLng: v.number(),
    offeredPay: v.number(),
    timeWindow: v.string(),
  },
  handler: async (ctx, args) => {
    const senderId = await getAuthUserId(ctx);
    if (!senderId) throw new Error("Not authenticated");

    const jobId = await ctx.db.insert("jobs", {
      ...args,
      status: "open",
      senderId,
      takerId: undefined,
      createdAt: Date.now(),
      confirmedAt: undefined,
    });

    return jobId;
  },
});

export const listMyOpenJobs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("jobs")
      .withIndex("by_status_senderId", (q) =>
        q.eq("status", "open").eq("senderId", userId),
      )
      .order("desc")
      .collect();
  },
});

export const listMyOpenJobsLimited = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("jobs")
      .withIndex("by_status_senderId", (q) =>
        q.eq("status", "open").eq("senderId", userId),
      )
      .order("desc")
      .take(8);
  },
});

export const listLiveAssignments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const assigned = await ctx.db
      .query("jobs")
      .withIndex("by_status_senderId", (q) =>
        q.eq("status", "assigned").eq("senderId", userId),
      )
      .order("desc")
      .collect();

    const picked = await ctx.db
      .query("jobs")
      .withIndex("by_status_senderId", (q) =>
        q.eq("status", "picked").eq("senderId", userId),
      )
      .order("desc")
      .collect();

    return [...assigned, ...picked].sort(
      (a, b) => (b.createdAt ?? b._creationTime) - (a.createdAt ?? a._creationTime),
    );
  },
});

export const availableJobsNearby = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusKm: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const myPendingBids = await ctx.db
      .query("bids")
      .withIndex("by_takerId", (q) => q.eq("takerId", userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    const pendingJobIds = new Set(myPendingBids.map((b) => b.jobId));

    const radiusKm = clampRadiusKm(args.radiusKm);

    const openJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(200);

    const within = [] as Array<
      {
        _id: (typeof openJobs)[number]["_id"];
        title: (typeof openJobs)[number]["title"];
        timeWindow: (typeof openJobs)[number]["timeWindow"];
        offeredPay: (typeof openJobs)[number]["offeredPay"];
        pickupAddress: (typeof openJobs)[number]["pickupAddress"];
        lat: (typeof openJobs)[number]["lat"];
        lng: (typeof openJobs)[number]["lng"];
        createdAt: (typeof openJobs)[number]["createdAt"];
        pickupDistanceKm: number;
        pickupToDropKm: number;
        totalDistanceKm: number;
      }
    >;

    for (const job of openJobs) {
      if (job.senderId === userId) continue;
      if (pendingJobIds.has(job._id)) continue;

      const pickupDistanceKm = haversineKm(args.lat, args.lng, job.lat, job.lng);
      if (pickupDistanceKm > radiusKm) continue;

      const pickupToDropKm =
        job.dropLat !== undefined && job.dropLng !== undefined
          ? haversineKm(job.lat, job.lng, job.dropLat, job.dropLng)
          : 0;

      within.push({
        _id: job._id,
        title: job.title,
        timeWindow: job.timeWindow,
        offeredPay: job.offeredPay,
        pickupAddress: job.pickupAddress,
        lat: job.lat,
        lng: job.lng,
        createdAt: job.createdAt,
        pickupDistanceKm,
        pickupToDropKm,
        totalDistanceKm: pickupDistanceKm + pickupToDropKm,
      });
    }

    within.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return within.slice(0, 8);
  },
});

export const listLiveFromOthers = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusKm: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const myPendingBids = await ctx.db
      .query("bids")
      .withIndex("by_takerId", (q) => q.eq("takerId", userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    const pendingJobIds = new Set(myPendingBids.map((b) => b.jobId));

    const radiusKm = clampRadiusKm(args.radiusKm);

    const openJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(200);

    const within = [] as Array<
      {
        _id: (typeof openJobs)[number]["_id"];
        title: (typeof openJobs)[number]["title"];
        timeWindow: (typeof openJobs)[number]["timeWindow"];
        offeredPay: (typeof openJobs)[number]["offeredPay"];
        pickupAddress: (typeof openJobs)[number]["pickupAddress"];
        lat: (typeof openJobs)[number]["lat"];
        lng: (typeof openJobs)[number]["lng"];
        createdAt: (typeof openJobs)[number]["createdAt"];
        pickupDistanceKm: number;
        pickupToDropKm: number;
        totalDistanceKm: number;
      }
    >;

    for (const job of openJobs) {
      if (job.senderId === userId) continue;
      if (pendingJobIds.has(job._id)) continue;

      const pickupDistanceKm = haversineKm(args.lat, args.lng, job.lat, job.lng);
      if (pickupDistanceKm > radiusKm) continue;

      const pickupToDropKm =
        job.dropLat !== undefined && job.dropLng !== undefined
          ? haversineKm(job.lat, job.lng, job.dropLat, job.dropLng)
          : 0;

      within.push({
        _id: job._id,
        title: job.title,
        timeWindow: job.timeWindow,
        offeredPay: job.offeredPay,
        pickupAddress: job.pickupAddress,
        lat: job.lat,
        lng: job.lng,
        createdAt: job.createdAt,
        pickupDistanceKm,
        pickupToDropKm,
        totalDistanceKm: pickupDistanceKm + pickupToDropKm,
      });
    }

    within.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return within;
  },
});

export const listAssignedToMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const assigned = await ctx.db
      .query("jobs")
      .withIndex("by_status_takerId", (q) =>
        q.eq("status", "assigned").eq("takerId", userId),
      )
      .order("desc")
      .collect();

    const picked = await ctx.db
      .query("jobs")
      .withIndex("by_status_takerId", (q) =>
        q.eq("status", "picked").eq("takerId", userId),
      )
      .order("desc")
      .collect();

    return [...assigned, ...picked]
      .sort(
        (a, b) => (b.createdAt ?? b._creationTime) - (a.createdAt ?? a._creationTime),
      )
      .map((job) => ({
        _id: job._id,
        title: job.title,
        description: job.description,
        timeWindow: job.timeWindow,
        offeredPay: job.offeredPay,
        pickupAddress: job.pickupAddress,
        dropAddress: job.dropAddress,
        status: job.status,
        senderId: job.senderId,
        takerId: job.takerId,
        createdAt: job.createdAt,
        cancelRequested: Boolean(job.cancelCodeRequestedAt),
      }));
  },
});

export const getJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    const { cancelCode, ...jobWithoutCancel } = job;
    const sender = await ctx.db.get(job.senderId);
    const taker = job.takerId ? await ctx.db.get(job.takerId) : null;
    const handoffs = await ctx.db
      .query("handoffs")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();
    const senderStatsJobs = await ctx.db
      .query("jobs")
      .withIndex("by_senderId", (q) => q.eq("senderId", job.senderId))
      .collect();
    const senderStats = {
      jobsPostedTotal: senderStatsJobs.length,
      jobsPostedDone: senderStatsJobs.filter((j) => j.confirmedAt).length,
      jobsDone: sender?.completedJobs ?? 0,
      joinedAt: sender?.createdAt ?? sender?._creationTime,
    };

    let takerStats = null as
      | {
          jobsDone: number;
          jobsPostedTotal: number;
          jobsPostedDone: number;
          joinedAt: number | undefined;
        }
      | null;

    if (taker) {
      const takerPosted = await ctx.db
        .query("jobs")
        .withIndex("by_senderId", (q) => q.eq("senderId", taker._id))
        .collect();

      takerStats = {
        jobsDone: taker.completedJobs ?? 0,
        jobsPostedTotal: takerPosted.length,
        jobsPostedDone: takerPosted.filter((j) => j.confirmedAt).length,
        joinedAt: taker.createdAt ?? taker._creationTime,
      };
    }

    return {
      job: { ...jobWithoutCancel, cancelRequested: Boolean(job.cancelCodeRequestedAt) },
      sender,
      senderStats,
      taker,
      takerStats,
      handoffs,
    };
  },
});

export const listMyJobs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("jobs")
      .withIndex("by_senderId", (q) => q.eq("senderId", userId))
      .order("desc")
      .collect();
  },
});

export const jobsNearMe = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusKm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const radiusKm = args.radiusKm ?? 10;

    // NOTE: Convex's geospatial index helpers are not present in the installed SDK
    // here, so for MVP we query open jobs and filter precisely by haversine.
    const openJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(200);

    const within = [] as Array<
      (typeof openJobs)[number] & { distanceKm: number }
    >;

    for (const job of openJobs) {
      const distanceKm = haversineKm(args.lat, args.lng, job.lat, job.lng);
      if (distanceKm <= radiusKm) within.push({ ...job, distanceKm });
    }

    within.sort((a, b) => a.distanceKm - b.distanceKm);
    return within;
  },
});

export const confirmDelivery = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.senderId !== userId) throw new Error("Not allowed");
    if (job.status !== "delivered") throw new Error("Not delivered yet");

    if (!job.confirmedAt) {
      await ctx.db.patch(args.jobId, { confirmedAt: Date.now() });

      if (job.takerId) {
        const taker = await ctx.db.get(job.takerId);
        if (taker) {
          await ctx.db.patch(job.takerId, {
            completedJobs: (taker.completedJobs ?? 0) + 1,
          });
        }
      }

      const sender = await ctx.db.get(job.senderId);
      if (sender) {
        await ctx.db.patch(job.senderId, {
          completedJobs: (sender.completedJobs ?? 0) + 1,
        });
      }
    }

    return { confirmedAt: Date.now() };
  },
});

export const scheduleAutoConfirm = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    if (job.status !== "delivered") return;
    if (job.confirmedAt) return;

    await ctx.scheduler.runAfter(24 * 60 * 60 * 1000, api.jobs.autoConfirm, {
      jobId: args.jobId,
    });
  },
});

export const autoConfirm = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    if (job.status !== "delivered") return;
    if (job.confirmedAt) return;

    await ctx.db.patch(args.jobId, { confirmedAt: Date.now() });

    if (job.takerId) {
      const taker = await ctx.db.get(job.takerId);
      if (taker) {
        await ctx.db.patch(job.takerId, {
          completedJobs: (taker.completedJobs ?? 0) + 1,
        });
      }
    }

    const sender = await ctx.db.get(job.senderId);
    if (sender) {
      await ctx.db.patch(job.senderId, {
        completedJobs: (sender.completedJobs ?? 0) + 1,
      });
    }
  },
});

export const requestDeliveryCode = mutation({
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
    if (job.status !== "assigned" && job.status !== "picked") {
      throw new Error("Job is not active");
    }

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

    const code = String(Math.floor(Math.random() * 10000)).padStart(4, "0");

    await ctx.db.patch(args.jobId, {
      deliveryCode: code,
      deliveryCodeRequestedAt: Date.now(),
    });

    await addNotification(ctx, {
      userId: job.senderId,
      type: "deliveryCode",
      title: "Delivery code generated",
      body: `Code for ${job.title}: ${code}. Review the dropoff photo before sharing.`,
      jobId: job._id,
    });

    return { ok: true } as const;
  },
});

export const requestCancelCode = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.takerId !== userId) throw new Error("Not allowed");
    if (job.status !== "assigned" && job.status !== "picked") {
      throw new Error("Job is not active");
    }

    if (job.cancelCodeRequestedAt) {
      throw new Error("Cancellation already requested");
    }

    await ctx.db.patch(args.jobId, {
      cancelCode: undefined,
      cancelCodeRequestedAt: Date.now(),
    });

    await addNotification(ctx, {
      userId: job.senderId,
      type: "cancelCode",
      title: "Cancellation approval needed",
      body: `${job.title} taker asked to cancel. Approve to reopen the job for bidding.`,
      jobId: job._id,
    });

    return { ok: true } as const;
  },
});

export const deleteJob = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.senderId !== userId) throw new Error("Not allowed");
    if (job.status !== "open" && job.status !== "assigned") {
      throw new Error("Can only delete open or assigned jobs");
    }

    const bids = await ctx.db
      .query("bids")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();

    for (const bid of bids) {
      if (bid.status === "pending") {
        await addNotification(ctx, {
          userId: bid.takerId,
          type: "jobDeleted",
          title: "Job removed",
          body: `${job.title} was removed by the poster.`,
          jobId: job._id,
        });
      }
      await ctx.db.delete(bid._id);
    }

    const handoffs = await ctx.db
      .query("handoffs")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();
    for (const h of handoffs) {
      await ctx.db.delete(h._id);
    }

    await ctx.db.delete(args.jobId);
  },
});

export const approveCancelRequest = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.senderId !== userId) throw new Error("Not allowed");
    if (job.status !== "assigned" && job.status !== "picked") {
      throw new Error("Job is not active");
    }
    if (!job.cancelCodeRequestedAt) throw new Error("No cancellation requested");

    const bids = await ctx.db
      .query("bids")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();

    for (const bid of bids) {
      if (bid.status === "accepted") {
        await addNotification(ctx, {
          userId: bid.takerId,
          type: "cancelApproved",
          title: "Cancellation approved",
          body: `${job.title} cancellation approved by the poster.`,
          jobId: job._id,
        });
      }
      await ctx.db.delete(bid._id);
    }

    if (job.takerId) {
      await addNotification(ctx, {
        userId: job.takerId,
        type: "cancelApproved",
        title: "Cancellation approved",
        body: `${job.title} cancellation approved by the poster.`,
        jobId: job._id,
      });
    }

    const handoffs = await ctx.db
      .query("handoffs")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();
    for (const h of handoffs) {
      await ctx.db.delete(h._id);
    }

    await ctx.db.patch(args.jobId, {
      status: "open",
      takerId: undefined,
      cancelCode: undefined,
      cancelCodeRequestedAt: undefined,
      deliveryCode: undefined,
      deliveryCodeRequestedAt: undefined,
    });

    return { ok: true } as const;
  },
});

export const verifyDeliveryCode = mutation({
  args: {
    jobId: v.id("jobs"),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.takerId !== userId) throw new Error("Not allowed");
    if (job.status !== "assigned" && job.status !== "picked") {
      throw new Error("Job is not active");
    }
    if (!job.deliveryCode) throw new Error("Delivery code not set");

    if (job.deliveryCode !== args.code.trim()) {
      throw new Error("Invalid code");
    }

    await ctx.db.patch(args.jobId, {
      status: "delivered",
      deliveryCode: undefined,
      deliveryCodeRequestedAt: undefined,
    });

    await ctx.runMutation(api.jobs.scheduleAutoConfirm, {
      jobId: args.jobId,
    });

    await addNotification(ctx, {
      userId: job.senderId,
      type: "info",
      title: "Item delivered",
      body: `${job.title} was marked delivered by the taker.`,
      jobId: job._id,
    });

    return { ok: true } as const;
  },
});

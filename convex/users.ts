import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

export const updateMe = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatar: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    livingAddress: v.optional(v.string()),
    adhaarNumber: v.optional(v.string()),
    idProofUrl: v.optional(v.string()),
    selfieUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db.get(userId);
    await ctx.db.patch(userId, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.email !== undefined ? { email: args.email } : {}),
      ...(args.avatar !== undefined ? { avatar: args.avatar } : {}),
      ...(args.phoneNumber !== undefined ? { phoneNumber: args.phoneNumber } : {}),
      ...(args.livingAddress !== undefined ? { livingAddress: args.livingAddress } : {}),
      ...(args.adhaarNumber !== undefined ? { adhaarNumber: args.adhaarNumber } : {}),
      ...(args.idProofUrl !== undefined ? { idProofUrl: args.idProofUrl } : {}),
      ...(args.selfieUrl !== undefined ? { selfieUrl: args.selfieUrl } : {}),
      ...(existing?.createdAt ? {} : { createdAt: Date.now() }),
    });
  },
});

export const saveIdSelfie = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Upload not found");

    await ctx.db.patch(userId, {
      idSelfieUrl: url,
      verified: true,
    });

    return { idSelfieUrl: url };
  },
});

export const saveIdProof = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Upload not found");

    await ctx.db.patch(userId, {
      idProofUrl: url,
    });

    return { idProofUrl: url };
  },
});

export const getUserPage = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const posted = await ctx.db
      .query("jobs")
      .withIndex("by_senderId", (q) => q.eq("senderId", args.userId))
      .collect();
    const postedDone = posted.filter((j) => j.confirmedAt).length;

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      idSelfieUrl: user.idSelfieUrl,
      phoneNumber: user.phoneNumber,
      livingAddress: user.livingAddress,
      adhaarNumber: user.adhaarNumber,
      idProofUrl: user.idProofUrl,
      rating: user.rating,
      verified: user.verified,
      completedJobs: user.completedJobs ?? 0,
      createdAt: user.createdAt ?? user._creationTime,
      stats: {
        jobsPostedTotal: posted.length,
        jobsPostedDone: postedDone,
      },
    };
  },
});

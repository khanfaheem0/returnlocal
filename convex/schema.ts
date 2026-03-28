import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatar: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    livingAddress: v.optional(v.string()),
    adhaarNumber: v.optional(v.string()),
    idProofUrl: v.optional(v.string()),
    selfieUrl: v.optional(v.string()),
    idSelfieUrl: v.optional(v.string()),
    verified: v.boolean(),
    rating: v.number(),
    completedJobs: v.number(),
    createdAt: v.optional(v.number()),
  }).index("email", ["email"]),

  jobs: defineTable({
    title: v.string(),
    description: v.string(),
    pickupAddress: v.string(),
    lat: v.number(),
    lng: v.number(),
    dropAddress: v.optional(v.string()),
    dropLat: v.optional(v.number()),
    dropLng: v.optional(v.number()),
    offeredPay: v.number(),
    timeWindow: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("assigned"),
      v.literal("picked"),
      v.literal("delivered"),
    ),
    senderId: v.id("users"),
    takerId: v.optional(v.id("users")),
    createdAt: v.number(),
    confirmedAt: v.optional(v.number()),
    deliveryCode: v.optional(v.string()),
    deliveryCodeRequestedAt: v.optional(v.number()),
    cancelCode: v.optional(v.string()),
    cancelCodeRequestedAt: v.optional(v.number()),
  })
    .index("by_senderId", ["senderId"])
    .index("by_takerId", ["takerId"])
    .index("by_status", ["status"])
    .index("by_status_senderId", ["status", "senderId"])
    .index("by_status_takerId", ["status", "takerId"]),

  bids: defineTable({
    jobId: v.id("jobs"),
    takerId: v.id("users"),
    message: v.optional(v.string()),
    amount: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("withdrawn"),
    ),
  })
    .index("by_jobId", ["jobId"])
    .index("by_takerId", ["takerId"])
    .index("by_jobId_status", ["jobId", "status"]),

  handoffs: defineTable({
    jobId: v.id("jobs"),
    photoUrl: v.string(),
    gpsLat: v.number(),
    gpsLng: v.number(),
    timestamp: v.number(),
    type: v.union(v.literal("pickup"), v.literal("dropoff")),
  })
    .index("by_jobId", ["jobId"])
    .index("by_jobId_type", ["jobId", "type"]),

  ratings: defineTable({
    jobId: v.id("jobs"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    score: v.number(),
    comment: v.optional(v.string()),
  })
    .index("by_jobId", ["jobId"])
    .index("by_toUserId", ["toUserId"]),

  notifications: defineTable({
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.optional(v.string()),
    jobId: v.optional(v.id("jobs")),
    createdAt: v.number(),
    read: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),
});

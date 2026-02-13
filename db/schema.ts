import { relations, sql } from "drizzle-orm";
import {
  boolean,
  decimal,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core";

// =========================================================
// 1. ENUMS
// =========================================================

// Global Role: "ADMIN" can create organizations. "USER" is a standard signup.
export const globalRoleEnum = pgEnum("global_role", ["ADMIN", "USER"]);

// Org Role: "OWNER" (The Admin who made it), "MANAGER" (Approver), "OFFICER" (Worker)
export const orgRoleEnum = pgEnum("org_role", ["OWNER", "MANAGER", "OFFICER"]);

export const memberStatusEnum = pgEnum("member_status", ["PENDING", "ACTIVE", "REJECTED", "INACTIVE"]);
export const logTypeEnum = pgEnum("log_type", ["FEED", "MORTALITY", "NOTE", "CORRECTION", "SYSTEM", "SALES"]);


// =========================================================
// 2. AUTHENTICATION (Better Auth Standard)
// =========================================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  activeMode: text("active_mode").$type<"ADMIN" | "USER">().notNull().default("USER"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  // Custom Field for Global Admin logic
  globalRole: globalRoleEnum("global_role").default("USER").notNull(),
  isPro: boolean("is_pro").default(false).notNull(),
  proExpiresAt: timestamp("pro_expires_at"), // null = never had Pro or no expiration set

  twoFactorEnabled: boolean("two_factor_enabled"),
});

export const featureRequest = pgTable("feature_request", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(), // e.g., "BULK_IMPORT"
  status: text("status").notNull().default("PENDING"), // PENDING, APPROVED, REJECTED
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_feature_req_user").on(t.userId),
]);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
});


// =========================================================
// 3. MULTI-TENANCY (Organizations & Members)
// =========================================================

export const organization = pgTable("organization", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  feedPricePerBag: decimal("feed_price_per_bag").default("2500"), // Default until changed
  slug: text("slug").unique().notNull(), // for URLs like /app/my-farm
  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const member = pgTable("member", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),

  // ROLE & STATUS
  role: orgRoleEnum("role").notNull().default("OFFICER"),
  status: memberStatusEnum("status").notNull().default("PENDING"),
  activeMode: text("active_mode").$type<"MANAGEMENT" | "OFFICER">().notNull().default("OFFICER"),

  // Access Level for Managers (VIEW or EDIT)
  accessLevel: text("access_level").$type<"VIEW" | "EDIT">().notNull().default("VIEW"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  // A user can only join an org once
  uniqueIndex("unique_org_member").on(t.userId, t.organizationId),
  index("idx_member_org_id").on(t.organizationId),
  index("idx_member_user_id").on(t.userId),
]);


// =========================================================
// 4. DOMAIN (Farmers, Cycles, History, Logs)
// =========================================================

export const farmer = pgTable("farmer", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  location: text("location"), // Optional - farm location/address
  mobile: text("mobile"),     // Optional - farmer's mobile number

  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  mainStock: real("main_stock").notNull(),
  totalConsumed: real("total_consumed").notNull().default(0),
  // STRICT OWNERSHIP: Only the officer who created this farmer can manage them
  officerId: text("officer_id").notNull().references(() => user.id),

  // SECURITY MONEY
  securityMoney: decimal("security_money").notNull().default("0"),

  status: text("status").notNull().default("active"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_farmer_org_id").on(t.organizationId),
  index("idx_farmer_officer_id").on(t.officerId),
  // Case-Insensitive UNIQUE per Officer (Partial: only active farmers)
  uniqueIndex("unique_farmer_name_per_officer_ci").on(t.organizationId, t.officerId, t.name).where(sql`status = 'active'`),
]);

export const farmerSecurityMoneyLogs = pgTable("farmer_security_money_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  farmerId: text("farmer_id").notNull().references(() => farmer.id, { onDelete: "cascade" }),

  previousAmount: decimal("previous_amount").notNull(),
  newAmount: decimal("new_amount").notNull(),

  changedBy: text("changed_by").notNull().references(() => user.id),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  reason: text("reason"),
}, (t) => [
  index("idx_security_logs_farmer_id").on(t.farmerId),
]);

export const cycles = pgTable("cycles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(), // e.g., "Batch-2024-A"

  // Ownership
  farmerId: text("farmer_id").notNull().references(() => farmer.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),

  // Data
  doc: integer("doc").notNull(), // Day Old Chicks count
  birdsSold: integer("birds_sold").notNull().default(0),
  intake: real("intake").notNull().default(0),
  mortality: integer("mortality").notNull().default(0),
  age: integer("age").notNull().default(0),
  status: text("status").notNull().default("active"),
  birdType: text("bird_type"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_cycles_org_id").on(t.organizationId),
  index("idx_cycles_farmer_id").on(t.farmerId),
]);

// ARCHIVE TABLE: Stores completed cycles
export const cycleHistory = pgTable("cycle_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

  cycleName: text("cycle_name").notNull(),
  farmerId: text("farmer_id").notNull().references(() => farmer.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),

  // Snapshot of final stats
  doc: integer("doc").notNull(),
  birdsSold: integer("birds_sold").notNull().default(0),
  finalIntake: real("final_intake").notNull(),
  mortality: integer("mortality").notNull(),
  age: integer("age").notNull(),

  status: text("status").notNull().default("archived"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").defaultNow().notNull(),
  birdType: text("bird_type"),
}, (t) => [
  index("idx_history_org_id").on(t.organizationId),
  index("idx_history_farmer_id").on(t.farmerId),
]);

export const cycleLogs = pgTable("cycle_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Can belong to EITHER an active Cycle OR a History record
  // "Set null" on cycleId allows the log to persist even if the active cycle row is deleted/archived
  cycleId: text("cycle_id").references(() => cycles.id, { onDelete: "set null" }),
  historyId: text("history_id").references(() => cycleHistory.id, { onDelete: "cascade" }),

  userId: text("user_id").notNull().references(() => user.id),

  type: logTypeEnum("type").notNull(),
  valueChange: doublePrecision("value_change").notNull(),

  // Audit fields
  previousValue: doublePrecision("previous_value"),
  newValue: doublePrecision("new_value"),
  note: text("note"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  isReverted: boolean("is_reverted").default(false).notNull(),
}, (t) => [
  index("idx_logs_cycle_id").on(t.cycleId),
  index("idx_logs_history_id").on(t.historyId),
]);

// db/schema.ts
export const stockLogs = pgTable("stock_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

  farmerId: text("farmer_id").references(() => farmer.id),
  amount: decimal("amount").notNull(), // Positive for Add, Negative for Deduct
  type: varchar("type", { length: 50 }).notNull(), // "RESTOCK", "CYCLE_CLOSE", "CORRECTION", "INITIAL"
  referenceId: varchar("reference_id"), // ID of the Cycle or Restock Event
  driverName: text("driver_name"), // Added for bulk imports
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_stock_logs_farmer_id").on(t.farmerId),
]);

// =========================================================
// 4b. SALES TRACKING
// =========================================================

// Sale Events - Records actual sale transactions
export const saleEvents = pgTable("sale_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  cycleId: text("cycle_id").references(() => cycles.id, { onDelete: "set null" }),
  historyId: text("history_id").references(() => cycleHistory.id, { onDelete: "cascade" }),

  // Location (farmer name from DB via cycle→farmer relation)
  location: text("location").notNull(),
  party: text("party"), // Buyer/party name

  // Sale Data
  saleDate: timestamp("sale_date").notNull().defaultNow(),
  houseBirds: integer("house_birds").notNull(), // Birds at start of cycle
  birdsSold: integer("birds_sold").notNull(),
  totalMortality: integer("total_mortality").notNull(),

  totalWeight: decimal("total_weight").notNull(), // kg
  avgWeight: decimal("avg_weight").notNull(), // kg per bird
  pricePerKg: decimal("price_per_kg").notNull(),
  totalAmount: decimal("total_amount").notNull(),

  // Payment
  cashReceived: decimal("cash_received").default("0"),
  depositReceived: decimal("deposit_received").default("0"),

  // Dynamic feed arrays as JSON: [{type: "B1", bags: 15}, {type: "B2", bags: 38}]
  feedConsumed: text("feed_consumed").notNull(),
  feedStock: text("feed_stock").notNull(),

  medicineCost: decimal("medicine_cost").default("0"),
  selectedReportId: text("selected_report_id"),
  createdBy: text("created_by").notNull().references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_sale_events_cycle_id").on(t.cycleId),
  index("idx_sale_events_history_id").on(t.historyId),
]);

// Sale Reports - Multiple reports per event for adjustments
export const saleReports = pgTable("sale_reports", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  saleEventId: text("sale_event_id").notNull().references(() => saleEvents.id, { onDelete: "cascade" }),

  birdsSold: integer("birds_sold").notNull(),
  totalMortality: integer("total_mortality").default(0),
  totalWeight: decimal("total_weight").notNull(),
  pricePerKg: decimal("price_per_kg").notNull(),
  totalAmount: decimal("total_amount").notNull(),
  avgWeight: decimal("avg_weight").notNull(),
  // Financial Adjustments
  cashReceived: decimal("cash_received").default("0"),
  depositReceived: decimal("deposit_received").default("0"),
  medicineCost: decimal("medicine_cost").default("0"),

  adjustmentNote: text("adjustment_note"),
  feedConsumed: text("feed_consumed"), // JSON stringified array
  feedStock: text("feed_stock"),       // JSON stringified array

  createdBy: text("created_by").notNull().references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_sale_reports_event_id").on(t.saleEventId),
]);

// 4c. PERFORMANCE METRICS (AGGREGATED)
// =========================================================

export const saleMetrics = pgTable("sale_metrics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Link to cycle (not individual sales)
  cycleId: text("cycle_id").references(() => cycles.id, { onDelete: "set null" }),
  historyId: text("history_id").references(() => cycleHistory.id, { onDelete: "cascade" }),
  // ONE of these must be set - metrics belong to a cycle, active or archived

  // Calculated Production Metrics (for the ENTIRE cycle, all sales combined)
  fcr: decimal("fcr", { precision: 10, scale: 2 }).notNull(),
  epi: decimal("epi", { precision: 10, scale: 2 }).notNull(),
  survivalRate: decimal("survival_rate", { precision: 5, scale: 2 }).notNull(),
  averageWeight: decimal("average_weight", { precision: 10, scale: 3 }).notNull(), // kg per bird

  // Total birds (all sales combined)
  totalBirdsSold: integer("total_birds_sold").notNull(),
  totalDoc: integer("total_doc").notNull(),
  totalMortality: integer("total_mortality").notNull(),
  averageAge: decimal("average_age", { precision: 5, scale: 2 }).notNull(),

  // Financial Metrics (entire cycle)
  docCost: decimal("doc_cost").notNull(), // DOC × DOC_PRICE_PER_BIRD
  feedCost: decimal("feed_cost").notNull(), // total feed × FEED_PRICE_PER_BAG
  medicineCost: decimal("medicine_cost").notNull(),
  totalRevenue: decimal("total_revenue").notNull(),
  netProfit: decimal("net_profit").notNull(), // revenue - all costs

  // Metadata (audit trail - what prices were used)
  feedPriceUsed: decimal("feed_price_used").notNull().default("3220"),
  docPriceUsed: decimal("doc_price_used").notNull().default("41.5"),
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
  lastRecalculatedAt: timestamp("last_recalculated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_sale_metrics_cycle").on(t.cycleId),
  index("idx_sale_metrics_history").on(t.historyId),
  // Only ONE metrics row per cycle
  unique("unique_cycle_metrics").on(t.cycleId),
  unique("unique_history_metrics").on(t.historyId),
]);


// =========================================================
// 5. RELATIONS
// =========================================================

export const userRelations = relations(user, ({ many }) => ({
  memberships: many(member),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  farmers: many(farmer),
}));

export const memberRelations = relations(member, ({ one }) => ({
  user: one(user, { fields: [member.userId], references: [user.id] }),
  organization: one(organization, { fields: [member.organizationId], references: [organization.id] }),
}));

export const farmerRelations = relations(farmer, ({ one, many }) => ({
  organization: one(organization, { fields: [farmer.organizationId], references: [organization.id] }),
  officer: one(user, { fields: [farmer.officerId], references: [user.id] }),
  cycles: many(cycles),
  history: many(cycleHistory),
}));

export const cycleRelations = relations(cycles, ({ one, many }) => ({
  farmer: one(farmer, { fields: [cycles.farmerId], references: [farmer.id] }),
  logs: many(cycleLogs),
  saleEvents: many(saleEvents),
}));

export const historyRelations = relations(cycleHistory, ({ one, many }) => ({
  farmer: one(farmer, { fields: [cycleHistory.farmerId], references: [farmer.id] }),
  logs: many(cycleLogs),
  saleEvents: many(saleEvents),
}));

export const logRelations = relations(cycleLogs, ({ one }) => ({
  cycle: one(cycles, { fields: [cycleLogs.cycleId], references: [cycles.id] }),
  history: one(cycleHistory, { fields: [cycleLogs.historyId], references: [cycleHistory.id] }),
  editor: one(user, { fields: [cycleLogs.userId], references: [user.id] })
}));

export const securityLogRelations = relations(farmerSecurityMoneyLogs, ({ one }) => ({
  farmer: one(farmer, { fields: [farmerSecurityMoneyLogs.farmerId], references: [farmer.id] }),
  editor: one(user, { fields: [farmerSecurityMoneyLogs.changedBy], references: [user.id] }),
}));

export const saleEventRelations = relations(saleEvents, ({ one, many }) => ({
  cycle: one(cycles, { fields: [saleEvents.cycleId], references: [cycles.id] }),
  history: one(cycleHistory, { fields: [saleEvents.historyId], references: [cycleHistory.id] }),
  createdByUser: one(user, { fields: [saleEvents.createdBy], references: [user.id] }),
  reports: many(saleReports),
  selectedReport: one(saleReports, { fields: [saleEvents.selectedReportId], references: [saleReports.id] }),
}));

export const saleReportRelations = relations(saleReports, ({ one }) => ({
  saleEvent: one(saleEvents, { fields: [saleReports.saleEventId], references: [saleEvents.id] }),
  createdByUser: one(user, { fields: [saleReports.createdBy], references: [user.id] }),
}));

// =========================================================
// 6. NOTIFICATIONS
// =========================================================

export const notificationTypeEnum = pgEnum("notification_type", ["INFO", "WARNING", "CRITICAL", "SUCCESS", "UPDATE", "SALES"]);
export const feedOrderStatusEnum = pgEnum("feed_order_status", ["PENDING", "CONFIRMED"]);

export const notification = pgTable("notification", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  message: text("message").notNull(),
  details: text("details"),
  type: notificationTypeEnum("type").notNull().default("INFO"),
  link: text("link"),

  isRead: boolean("is_read").notNull().default(false),
  metadata: text("metadata"), // Storing JSON as text to be safe with all drivers, or use json() if postgres specific

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_notification_user").on(t.userId),
  index("idx_notification_org").on(t.organizationId),
  index("idx_notification_created").on(t.createdAt),
]);

// =========================================================
// 7. FEED ORDERS
// =========================================================

export const feedOrders = pgTable("feed_orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  officerId: text("officer_id").notNull().references(() => user.id),

  orderDate: timestamp("order_date").notNull(),
  deliveryDate: timestamp("delivery_date").notNull(),
  status: feedOrderStatusEnum("status").notNull().default("PENDING"),
  driverName: text("driver_name"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_feed_order_org").on(t.orgId),
  index("idx_feed_order_officer").on(t.officerId),
]);

export const feedOrderItems = pgTable("feed_order_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  feedOrderId: text("feed_order_id").notNull().references(() => feedOrders.id, { onDelete: "cascade" }),
  farmerId: text("farmer_id").notNull().references(() => farmer.id, { onDelete: "cascade" }),

  // e.g. "B1", "B2"
  feedType: text("feed_type").notNull(),
  // e.g. 10, 20
  quantity: integer("quantity").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_feed_order_item_order").on(t.feedOrderId),
]);

export const feedOrderRelations = relations(feedOrders, ({ many, one }) => ({
  items: many(feedOrderItems),
  organization: one(organization, { fields: [feedOrders.orgId], references: [organization.id] }),
  officer: one(user, { fields: [feedOrders.officerId], references: [user.id] }),
}));

export const feedOrderItemRelations = relations(feedOrderItems, ({ one }) => ({
  order: one(feedOrders, { fields: [feedOrderItems.feedOrderId], references: [feedOrders.id] }),
  farmer: one(farmer, { fields: [feedOrderItems.farmerId], references: [farmer.id] }),
}));

// =========================================================
// 8. DOC ORDERS
// =========================================================

export const docOrderStatusEnum = pgEnum("doc_order_status", ["PENDING", "CONFIRMED"]);

export const birdTypes = pgTable("bird_types", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(), // e.g., "Ross A", "EP A"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const docOrders = pgTable("doc_orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  officerId: text("officer_id").notNull().references(() => user.id),

  orderDate: timestamp("order_date").notNull(),
  status: docOrderStatusEnum("status").notNull().default("PENDING"),

  // Optional metadata if needed, like "Branch Name" could be stored or just used for message generation.
  // The user requested "Branch Name" for the message. We might not strictly need to store it if it's transient, 
  // but better to store it if they want to edit it later.
  branchName: text("branch_name"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_doc_order_org").on(t.orgId),
  index("idx_doc_order_officer").on(t.officerId),
]);

export const docOrderItems = pgTable("doc_order_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  docOrderId: text("doc_order_id").notNull().references(() => docOrders.id, { onDelete: "cascade" }),
  farmerId: text("farmer_id").notNull().references(() => farmer.id, { onDelete: "cascade" }),

  birdType: text("bird_type").notNull(), // Stored as string, picked from birdTypes
  docCount: integer("doc_count").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_doc_order_item_order").on(t.docOrderId),
]);

export const docOrderRelations = relations(docOrders, ({ many, one }) => ({
  items: many(docOrderItems),
  organization: one(organization, { fields: [docOrders.orgId], references: [organization.id] }),
  officer: one(user, { fields: [docOrders.officerId], references: [user.id] }),
}));

export const docOrderItemRelations = relations(docOrderItems, ({ one }) => ({
  order: one(docOrders, { fields: [docOrderItems.docOrderId], references: [docOrders.id] }),
  farmer: one(farmer, { fields: [docOrderItems.farmerId], references: [farmer.id] }),
}));

"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notification = exports.notificationTypeEnum = exports.saleReportRelations = exports.saleEventRelations = exports.securityLogRelations = exports.logRelations = exports.historyRelations = exports.cycleRelations = exports.farmerRelations = exports.memberRelations = exports.organizationRelations = exports.userRelations = exports.saleReports = exports.saleEvents = exports.stockLogs = exports.cycleLogs = exports.cycleHistory = exports.cycles = exports.farmerSecurityMoneyLogs = exports.farmer = exports.member = exports.organization = exports.twoFactor = exports.verification = exports.account = exports.session = exports.featureRequest = exports.user = exports.logTypeEnum = exports.memberStatusEnum = exports.orgRoleEnum = exports.globalRoleEnum = void 0;
var drizzle_orm_1 = require("drizzle-orm");
var pg_core_1 = require("drizzle-orm/pg-core");
// =========================================================
// 1. ENUMS
// =========================================================
// Global Role: "ADMIN" can create organizations. "USER" is a standard signup.
exports.globalRoleEnum = (0, pg_core_1.pgEnum)("global_role", ["ADMIN", "USER"]);
// Org Role: "OWNER" (The Admin who made it), "MANAGER" (Approver), "OFFICER" (Worker)
exports.orgRoleEnum = (0, pg_core_1.pgEnum)("org_role", ["OWNER", "MANAGER", "OFFICER"]);
exports.memberStatusEnum = (0, pg_core_1.pgEnum)("member_status", ["PENDING", "ACTIVE", "REJECTED", "INACTIVE"]);
exports.logTypeEnum = (0, pg_core_1.pgEnum)("log_type", ["FEED", "MORTALITY", "NOTE", "CORRECTION", "SYSTEM"]);
// =========================================================
// 2. AUTHENTICATION (Better Auth Standard)
// =========================================================
exports.user = (0, pg_core_1.pgTable)("user", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    emailVerified: (0, pg_core_1.boolean)("email_verified").notNull().default(false),
    image: (0, pg_core_1.text)("image"),
    activeMode: (0, pg_core_1.text)("active_mode").$type().notNull().default("USER"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
    // Custom Field for Global Admin logic
    globalRole: (0, exports.globalRoleEnum)("global_role").default("USER").notNull(),
    isPro: (0, pg_core_1.boolean)("is_pro").default(false).notNull(),
    proExpiresAt: (0, pg_core_1.timestamp)("pro_expires_at"), // null = never had Pro or no expiration set
    twoFactorEnabled: (0, pg_core_1.boolean)("two_factor_enabled"),
});
exports.featureRequest = (0, pg_core_1.pgTable)("feature_request", {
    id: (0, pg_core_1.text)("id").primaryKey().$defaultFn(function () { return crypto.randomUUID(); }),
    userId: (0, pg_core_1.text)("user_id").notNull().references(function () { return exports.user.id; }, { onDelete: "cascade" }),
    feature: (0, pg_core_1.text)("feature").notNull(), // e.g., "BULK_IMPORT"
    status: (0, pg_core_1.text)("status").notNull().default("PENDING"), // PENDING, APPROVED, REJECTED
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
}, function (t) { return [
    (0, pg_core_1.index)("idx_feature_req_user").on(t.userId),
]; });
exports.session = (0, pg_core_1.pgTable)("session", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    token: (0, pg_core_1.text)("token").notNull().unique(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    userId: (0, pg_core_1.text)("user_id").notNull().references(function () { return exports.user.id; }, { onDelete: "cascade" }),
});
exports.account = (0, pg_core_1.pgTable)("account", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    accountId: (0, pg_core_1.text)("account_id").notNull(),
    providerId: (0, pg_core_1.text)("provider_id").notNull(),
    userId: (0, pg_core_1.text)("user_id").notNull().references(function () { return exports.user.id; }, { onDelete: "cascade" }),
    accessToken: (0, pg_core_1.text)("access_token"),
    refreshToken: (0, pg_core_1.text)("refresh_token"),
    idToken: (0, pg_core_1.text)("id_token"),
    accessTokenExpiresAt: (0, pg_core_1.timestamp)("access_token_expires_at"),
    refreshTokenExpiresAt: (0, pg_core_1.timestamp)("refresh_token_expires_at"),
    scope: (0, pg_core_1.text)("scope"),
    password: (0, pg_core_1.text)("password"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.verification = (0, pg_core_1.pgTable)("verification", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    identifier: (0, pg_core_1.text)("identifier").notNull(),
    value: (0, pg_core_1.text)("value").notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.twoFactor = (0, pg_core_1.pgTable)("two_factor", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    secret: (0, pg_core_1.text)("secret").notNull(),
    backupCodes: (0, pg_core_1.text)("backup_codes").notNull(),
    userId: (0, pg_core_1.text)("user_id").notNull().references(function () { return exports.user.id; }, { onDelete: "cascade" }),
    enabled: (0, pg_core_1.boolean)("enabled").notNull().default(false),
});
// =========================================================
// 3. MULTI-TENANCY (Organizations & Members)
// =========================================================
exports.organization = (0, pg_core_1.pgTable)("organization", {
    id: (0, pg_core_1.text)("id").primaryKey().$defaultFn(function () { return crypto.randomUUID(); }),
    name: (0, pg_core_1.text)("name").notNull(),
    slug: (0, pg_core_1.text)("slug").unique().notNull(), // for URLs like /app/my-farm
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
exports.member = (0, pg_core_1.pgTable)("member", {
    id: (0, pg_core_1.text)("id").primaryKey().$defaultFn(function () { return crypto.randomUUID(); }),
    userId: (0, pg_core_1.text)("user_id").notNull().references(function () { return exports.user.id; }, { onDelete: "cascade" }),
    organizationId: (0, pg_core_1.text)("organization_id").notNull().references(function () { return exports.organization.id; }, { onDelete: "cascade" }),
    // ROLE & STATUS
    role: (0, exports.orgRoleEnum)("role").notNull().default("OFFICER"),
    status: (0, exports.memberStatusEnum)("status").notNull().default("PENDING"),
    activeMode: (0, pg_core_1.text)("active_mode").$type().notNull().default("OFFICER"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, function (t) { return [
    // A user can only join an org once
    (0, pg_core_1.uniqueIndex)("unique_org_member").on(t.userId, t.organizationId),
    (0, pg_core_1.index)("idx_member_org_id").on(t.organizationId),
    (0, pg_core_1.index)("idx_member_user_id").on(t.userId),
]; });
// =========================================================
// 4. DOMAIN (Farmers, Cycles, History, Logs)
// =========================================================
exports.farmer = (0, pg_core_1.pgTable)("farmer", {
    id: (0, pg_core_1.text)("id").primaryKey().$defaultFn(function () { return crypto.randomUUID(); }),
    name: (0, pg_core_1.text)("name").notNull(),
    organizationId: (0, pg_core_1.text)("organization_id").notNull().references(function () { return exports.organization.id; }, { onDelete: "cascade" }),
    mainStock: (0, pg_core_1.real)("main_stock").notNull(),
    totalConsumed: (0, pg_core_1.real)("total_consumed").notNull().default(0),
    // STRICT OWNERSHIP: Only the officer who created this farmer can manage them
    officerId: (0, pg_core_1.text)("officer_id").notNull().references(function () { return exports.user.id; }),
    // SECURITY MONEY
    securityMoney: (0, pg_core_1.decimal)("security_money").notNull().default("0"),
    status: (0, pg_core_1.text)("status").notNull().default("active"),
    deletedAt: (0, pg_core_1.timestamp)("deleted_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, function (t) { return [
    (0, pg_core_1.index)("idx_farmer_org_id").on(t.organizationId),
    (0, pg_core_1.index)("idx_farmer_officer_id").on(t.officerId),
    // Case-Insensitive UNIQUE per Officer (Partial: only active farmers)
    (0, pg_core_1.uniqueIndex)("unique_farmer_name_per_officer_ci").on(t.organizationId, t.officerId, t.name).where((0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["status = 'active'"], ["status = 'active'"])))),
]; });
exports.farmerSecurityMoneyLogs = (0, pg_core_1.pgTable)("farmer_security_money_logs", {
    id: (0, pg_core_1.text)("id").primaryKey().$defaultFn(function () { return crypto.randomUUID(); }),
    farmerId: (0, pg_core_1.text)("farmer_id").notNull().references(function () { return exports.farmer.id; }, { onDelete: "cascade" }),
    previousAmount: (0, pg_core_1.decimal)("previous_amount").notNull(),
    newAmount: (0, pg_core_1.decimal)("new_amount").notNull(),
    changedBy: (0, pg_core_1.text)("changed_by").notNull().references(function () { return exports.user.id; }),
    changedAt: (0, pg_core_1.timestamp)("changed_at").defaultNow().notNull(),
    reason: (0, pg_core_1.text)("reason"),
}, function (t) { return [
    (0, pg_core_1.index)("idx_security_logs_farmer_id").on(t.farmerId),
]; });
exports.cycles = (0, pg_core_1.pgTable)("cycles", {
    id: (0, pg_core_1.text)("id").primaryKey().$defaultFn(function () { return crypto.randomUUID(); }),
    name: (0, pg_core_1.text)("name").notNull(), // e.g., "Batch-2024-A"
    // Ownership
    farmerId: (0, pg_core_1.text)("farmer_id").notNull().references(function () { return exports.farmer.id; }, { onDelete: "cascade" }),
    organizationId: (0, pg_core_1.text)("organization_id").notNull().references(function () { return exports.organization.id; }, { onDelete: "cascade" }),
    // Data
    doc: (0, pg_core_1.integer)("doc").notNull(), // Day Old Chicks count
    birdsSold: (0, pg_core_1.integer)("birds_sold").notNull().default(0),
    intake: (0, pg_core_1.real)("intake").notNull().default(0),
    mortality: (0, pg_core_1.integer)("mortality").notNull().default(0),
    age: (0, pg_core_1.integer)("age").notNull().default(0),
    status: (0, pg_core_1.text)("status").notNull().default("active"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
}, function (t) { return [
    (0, pg_core_1.index)("idx_cycles_org_id").on(t.organizationId),
    (0, pg_core_1.index)("idx_cycles_farmer_id").on(t.farmerId),
]; });
// ARCHIVE TABLE: Stores completed cycles
exports.cycleHistory = (0, pg_core_1.pgTable)("cycle_history", {
    id: (0, pg_core_1.text)("id").primaryKey().$defaultFn(function () { return crypto.randomUUID(); }),
    cycleName: (0, pg_core_1.text)("cycle_name").notNull(),
    farmerId: (0, pg_core_1.text)("farmer_id").notNull().references(function () { return exports.farmer.id; }, { onDelete: "cascade" }),
    organizationId: (0, pg_core_1.text)("organization_id").references(function () { return exports.organization.id; }, { onDelete: "cascade" }),
    // Snapshot of final stats
    doc: (0, pg_core_1.integer)("doc").notNull(),
    birdsSold: (0, pg_core_1.integer)("birds_sold").notNull(),
    finalIntake: (0, pg_core_1.real)("final_intake").notNull(),
    mortality: (0, pg_core_1.integer)("mortality").notNull(),
    age: (0, pg_core_1.integer)("age").notNull(),
    status: (0, pg_core_1.text)("status").notNull().default("archived"),
    startDate: (0, pg_core_1.timestamp)("start_date").notNull(),
    endDate: (0, pg_core_1.timestamp)("end_date").defaultNow().notNull(),
}, function (t) { return [
    (0, pg_core_1.index)("idx_history_org_id").on(t.organizationId),
    (0, pg_core_1.index)("idx_history_farmer_id").on(t.farmerId),
]; });
exports.cycleLogs = (0, pg_core_1.pgTable)("cycle_logs", {
    id: (0, pg_core_1.text)("id").primaryKey().$defaultFn(function () { return crypto.randomUUID(); }),
    // Can belong to EITHER an active Cycle OR a History record
    // "Set null" on cycleId allows the log to persist even if the active cycle row is deleted/archived
    cycleId: (0, pg_core_1.text)("cycle_id").references(function () { return exports.cycles.id; }, { onDelete: "set null" }),
    historyId: (0, pg_core_1.text)("history_id").references(function () { return exports.cycleHistory.id; }, { onDelete: "cascade" }),
    userId: (0, pg_core_1.text)("user_id").notNull().references(function () { return exports.user.id; }),
    type: (0, exports.logTypeEnum)("type").notNull(),
    valueChange: (0, pg_core_1.doublePrecision)("value_change").notNull(),
    // Audit fields
    previousValue: (0, pg_core_1.doublePrecision)("previous_value"),
    newValue: (0, pg_core_1.doublePrecision)("new_value"),
    note: (0, pg_core_1.text)("note"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, function (t) { return [
    (0, pg_core_1.index)("idx_logs_cycle_id").on(t.cycleId),
    (0, pg_core_1.index)("idx_logs_history_id").on(t.historyId),
]; });
// db/schema.ts
exports.stockLogs = (0, pg_core_1.pgTable)("stock_logs", {
    id: (0, pg_core_1.text)("id").primaryKey().$defaultFn(function () { return crypto.randomUUID(); }),
    farmerId: (0, pg_core_1.text)("farmer_id").references(function () { return exports.farmer.id; }),
    amount: (0, pg_core_1.decimal)("amount").notNull(), // Positive for Add, Negative for Deduct
    type: (0, pg_core_1.varchar)("type", { length: 50 }).notNull(), // "RESTOCK", "CYCLE_CLOSE", "CORRECTION", "INITIAL"
    referenceId: (0, pg_core_1.varchar)("reference_id"), // ID of the Cycle or Restock Event
    note: (0, pg_core_1.text)("note"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
}, function (t) { return [
    (0, pg_core_1.index)("idx_stock_logs_farmer_id").on(t.farmerId),
]; });
// =========================================================
// 4b. SALES TRACKING
// =========================================================
// Sale Events - Records actual sale transactions
exports.saleEvents = (0, pg_core_1.pgTable)("sale_events", {
    id: (0, pg_core_1.text)("id").primaryKey().$defaultFn(function () { return crypto.randomUUID(); }),
    cycleId: (0, pg_core_1.text)("cycle_id").references(function () { return exports.cycles.id; }, { onDelete: "set null" }),
    historyId: (0, pg_core_1.text)("history_id").references(function () { return exports.cycleHistory.id; }, { onDelete: "cascade" }),
    // Location (farmer name from DB via cycle→farmer relation)
    location: (0, pg_core_1.text)("location").notNull(),
    // Sale Data
    saleDate: (0, pg_core_1.timestamp)("sale_date").notNull().defaultNow(),
    houseBirds: (0, pg_core_1.integer)("house_birds").notNull(), // Birds at start of cycle
    birdsSold: (0, pg_core_1.integer)("birds_sold").notNull(),
    totalMortality: (0, pg_core_1.integer)("total_mortality").notNull(),
    totalWeight: (0, pg_core_1.decimal)("total_weight").notNull(), // kg
    avgWeight: (0, pg_core_1.decimal)("avg_weight").notNull(), // kg per bird
    pricePerKg: (0, pg_core_1.decimal)("price_per_kg").notNull(),
    totalAmount: (0, pg_core_1.decimal)("total_amount").notNull(),
    // Payment
    cashReceived: (0, pg_core_1.decimal)("cash_received").default("0"),
    depositReceived: (0, pg_core_1.decimal)("deposit_received").default("0"),
    // Dynamic feed arrays as JSON: [{type: "B1", bags: 15}, {type: "B2", bags: 38}]
    feedConsumed: (0, pg_core_1.text)("feed_consumed").notNull(),
    feedStock: (0, pg_core_1.text)("feed_stock").notNull(),
    medicineCost: (0, pg_core_1.decimal)("medicine_cost").default("0"),
    createdBy: (0, pg_core_1.text)("created_by").notNull().references(function () { return exports.user.id; }),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
}, function (t) { return [
    (0, pg_core_1.index)("idx_sale_events_cycle_id").on(t.cycleId),
    (0, pg_core_1.index)("idx_sale_events_history_id").on(t.historyId),
]; });
// Sale Reports - Multiple reports per event for adjustments
exports.saleReports = (0, pg_core_1.pgTable)("sale_reports", {
    id: (0, pg_core_1.text)("id").primaryKey().$defaultFn(function () { return crypto.randomUUID(); }),
    saleEventId: (0, pg_core_1.text)("sale_event_id").notNull().references(function () { return exports.saleEvents.id; }, { onDelete: "cascade" }),
    birdsSold: (0, pg_core_1.integer)("birds_sold").notNull(),
    totalWeight: (0, pg_core_1.decimal)("total_weight").notNull(),
    pricePerKg: (0, pg_core_1.decimal)("price_per_kg").notNull(),
    totalAmount: (0, pg_core_1.decimal)("total_amount").notNull(),
    avgWeight: (0, pg_core_1.decimal)("avg_weight").notNull(),
    adjustmentNote: (0, pg_core_1.text)("adjustment_note"),
    createdBy: (0, pg_core_1.text)("created_by").notNull().references(function () { return exports.user.id; }),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
}, function (t) { return [
    (0, pg_core_1.index)("idx_sale_reports_event_id").on(t.saleEventId),
]; });
// =========================================================
// 5. RELATIONS
// =========================================================
exports.userRelations = (0, drizzle_orm_1.relations)(exports.user, function (_a) {
    var many = _a.many;
    return ({
        memberships: many(exports.member),
    });
});
exports.organizationRelations = (0, drizzle_orm_1.relations)(exports.organization, function (_a) {
    var many = _a.many;
    return ({
        members: many(exports.member),
        farmers: many(exports.farmer),
    });
});
exports.memberRelations = (0, drizzle_orm_1.relations)(exports.member, function (_a) {
    var one = _a.one;
    return ({
        user: one(exports.user, { fields: [exports.member.userId], references: [exports.user.id] }),
        organization: one(exports.organization, { fields: [exports.member.organizationId], references: [exports.organization.id] }),
    });
});
exports.farmerRelations = (0, drizzle_orm_1.relations)(exports.farmer, function (_a) {
    var one = _a.one, many = _a.many;
    return ({
        organization: one(exports.organization, { fields: [exports.farmer.organizationId], references: [exports.organization.id] }),
        officer: one(exports.user, { fields: [exports.farmer.officerId], references: [exports.user.id] }),
        cycles: many(exports.cycles),
        history: many(exports.cycleHistory),
    });
});
exports.cycleRelations = (0, drizzle_orm_1.relations)(exports.cycles, function (_a) {
    var one = _a.one, many = _a.many;
    return ({
        farmer: one(exports.farmer, { fields: [exports.cycles.farmerId], references: [exports.farmer.id] }),
        logs: many(exports.cycleLogs),
        saleEvents: many(exports.saleEvents),
    });
});
exports.historyRelations = (0, drizzle_orm_1.relations)(exports.cycleHistory, function (_a) {
    var one = _a.one, many = _a.many;
    return ({
        farmer: one(exports.farmer, { fields: [exports.cycleHistory.farmerId], references: [exports.farmer.id] }),
        logs: many(exports.cycleLogs),
        saleEvents: many(exports.saleEvents),
    });
});
exports.logRelations = (0, drizzle_orm_1.relations)(exports.cycleLogs, function (_a) {
    var one = _a.one;
    return ({
        cycle: one(exports.cycles, { fields: [exports.cycleLogs.cycleId], references: [exports.cycles.id] }),
        history: one(exports.cycleHistory, { fields: [exports.cycleLogs.historyId], references: [exports.cycleHistory.id] }),
        editor: one(exports.user, { fields: [exports.cycleLogs.userId], references: [exports.user.id] })
    });
});
exports.securityLogRelations = (0, drizzle_orm_1.relations)(exports.farmerSecurityMoneyLogs, function (_a) {
    var one = _a.one;
    return ({
        farmer: one(exports.farmer, { fields: [exports.farmerSecurityMoneyLogs.farmerId], references: [exports.farmer.id] }),
        editor: one(exports.user, { fields: [exports.farmerSecurityMoneyLogs.changedBy], references: [exports.user.id] }),
    });
});
exports.saleEventRelations = (0, drizzle_orm_1.relations)(exports.saleEvents, function (_a) {
    var one = _a.one, many = _a.many;
    return ({
        cycle: one(exports.cycles, { fields: [exports.saleEvents.cycleId], references: [exports.cycles.id] }),
        history: one(exports.cycleHistory, { fields: [exports.saleEvents.historyId], references: [exports.cycleHistory.id] }),
        createdByUser: one(exports.user, { fields: [exports.saleEvents.createdBy], references: [exports.user.id] }),
        reports: many(exports.saleReports),
    });
});
exports.saleReportRelations = (0, drizzle_orm_1.relations)(exports.saleReports, function (_a) {
    var one = _a.one;
    return ({
        saleEvent: one(exports.saleEvents, { fields: [exports.saleReports.saleEventId], references: [exports.saleEvents.id] }),
        createdByUser: one(exports.user, { fields: [exports.saleReports.createdBy], references: [exports.user.id] }),
    });
});
// =========================================================
// 6. NOTIFICATIONS
// =========================================================
exports.notificationTypeEnum = (0, pg_core_1.pgEnum)("notification_type", ["INFO", "WARNING", "CRITICAL", "SUCCESS", "UPDATE"]);
exports.notification = (0, pg_core_1.pgTable)("notification", {
    id: (0, pg_core_1.text)("id").primaryKey().$defaultFn(function () { return crypto.randomUUID(); }),
    userId: (0, pg_core_1.text)("user_id").notNull().references(function () { return exports.user.id; }, { onDelete: "cascade" }),
    organizationId: (0, pg_core_1.text)("organization_id").references(function () { return exports.organization.id; }, { onDelete: "cascade" }),
    title: (0, pg_core_1.text)("title").notNull(),
    message: (0, pg_core_1.text)("message").notNull(),
    details: (0, pg_core_1.text)("details"),
    type: (0, exports.notificationTypeEnum)("type").notNull().default("INFO"),
    link: (0, pg_core_1.text)("link"),
    isRead: (0, pg_core_1.boolean)("is_read").notNull().default(false),
    metadata: (0, pg_core_1.text)("metadata"), // Storing JSON as text to be safe with all drivers, or use json() if postgres specific
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, function (t) { return [
    (0, pg_core_1.index)("idx_notification_user").on(t.userId),
    (0, pg_core_1.index)("idx_notification_org").on(t.organizationId),
    (0, pg_core_1.index)("idx_notification_created").on(t.createdAt),
]; });
var templateObject_1;

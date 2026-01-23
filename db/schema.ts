import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

// --- ENUMS ---
// Global Role: "ADMIN" can create organizations. "USER" is a standard signup.
export const globalRoleEnum = pgEnum("global_role", ["ADMIN", "USER"]);

// Org Role: "OWNER" (The Admin who made it), "MANAGER" (Approver), "OFFICER" (Worker)
export const orgRoleEnum = pgEnum("org_role", ["OWNER", "MANAGER", "OFFICER"]);

export const memberStatusEnum = pgEnum("member_status", ["PENDING", "ACTIVE", "REJECTED"]);
export const logTypeEnum = pgEnum("log_type", ["FEED", "MORTALITY", "NOTE"]);


// --- AUTHENTICATION (Better Auth Standard) ---

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  
  // Custom Field for your "Admin" logic
  globalRole: globalRoleEnum("global_role").default("USER").notNull(), 
});

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


// --- MULTI-TENANCY (The Hierarchy) ---

export const organization = pgTable("organization", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
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
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  // A user can only join an org once
  uniqueIndex("unique_org_member").on(t.userId, t.organizationId)
]);


// --- DOMAIN (Farmers & Cycles) ---

export const farmer = pgTable("farmer", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  
  // STRICT OWNERSHIP: Only the officer who created this farmer can manage them
  officerId: text("officer_id").notNull().references(() => user.id), 
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cycles = pgTable("cycles", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()), 
    name: text("name").notNull(), // e.g., "Batch-2024-A"
    
    // Ownership
    farmerId: text("farmer_id").notNull().references(() => farmer.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),

    // Data
    doc: integer("doc").notNull(), // Day Old Chicks count
    inputFeed: real("input_feed").notNull(),
    intake: real("intake").notNull().default(0),
    mortality: integer("mortality").notNull().default(0),
    age: integer("age").notNull().default(0),
    status: text("status").notNull().default("active"),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  }
);

export const cycleLogs = pgTable("cycle_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  cycleId: text("cycle_id").notNull().references(() => cycles.id, { onDelete: "cascade" }), 
  
  // Who made the log?
  userId: text("user_id").notNull().references(() => user.id),
  
  type: logTypeEnum("type").notNull(),
  valueChange: doublePrecision("value_change").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- RELATIONS ---

export const userRelations = relations(user, ({ many }) => ({
  memberships: many(member), // A user can be in many orgs
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
}));

export const cycleRelations = relations(cycles, ({ one, many }) => ({
  farmer: one(farmer, { fields: [cycles.farmerId], references: [farmer.id] }),
  logs: many(cycleLogs),
}));

export const logRelations = relations(cycleLogs, ({ one }) => ({
  cycle: one(cycles, { fields: [cycleLogs.cycleId], references: [cycles.id] }),
  editor: one(user, { fields: [cycleLogs.userId], references: [user.id] })
}));
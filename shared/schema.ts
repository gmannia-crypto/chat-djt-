import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const tokenAccounts = pgTable("token_accounts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull().unique(),
  tokens: integer("tokens").notNull().default(0),
  freePromptsUsed: integer("free_prompts_used").notNull().default(0),
  subscriptionActive: boolean("subscription_active").notNull().default(false),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  subscriptionTokensGranted: boolean("subscription_tokens_granted").notNull().default(false),
  lastMonthlyReset: timestamp("last_monthly_reset"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tokenTransactions = pgTable("token_transactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull(),
  type: varchar("type").notNull(),
  amount: integer("amount").notNull(),
  description: text("description"),
  stripeSessionId: varchar("stripe_session_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type TokenAccount = typeof tokenAccounts.$inferSelect;
export type TokenTransaction = typeof tokenTransactions.$inferSelect;

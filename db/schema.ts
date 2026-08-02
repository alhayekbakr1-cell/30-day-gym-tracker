import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const gymProgress = sqliteTable("gym_progress", {
  userEmail: text("user_email").primaryKey(),
  stateJson: text("state_json").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: integer("updated_at").notNull(),
});

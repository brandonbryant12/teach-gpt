import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  jsonb,
  pgEnum,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// Define the enum for podcast status
export const podcastStatusEnum = pgEnum('podcast_status', [
  'PENDING',
  'SCRAPING',
  'GENERATING_CONTENT',
  'GENERATING_AUDIO',
  'STITCHING',
  'COMPLETED',
  'FAILED',
]);

// Define the enum for deep dive options
export const deepDiveOptionEnum = pgEnum('deep_dive_option', [
  'CONDENSE',
  'RETAIN',
  'EXPAND',
]);

// Define the podcasts table
export const podcasts = pgTable('podcasts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  deepDiveOption: deepDiveOptionEnum('deep_dive_option').notNull(),

  // Job Status and Error Handling
  status: podcastStatusEnum('status').default('PENDING').notNull(),
  errorMessage: text('error_message'),
  errorStep: text('error_step'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),

  // Results and Metadata
  title: text('title'),
  summary: jsonb('summary'),
  transcript: jsonb('transcript'),
  audioUrl: text('audio_url'),
  jobMetadata: jsonb('job_metadata'),
});

// Define the relationship for easier querying (optional but recommended)
export const podcastRelations = relations(podcasts, ({ one }) => ({
  user: one(users, {
    fields: [podcasts.userId],
    references: [users.id],
  }),
}));

// Define the inverse relationship on the users table (optional)
export const userRelations = relations(users, ({ many }) => ({
  podcasts: many(podcasts),
}));

import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
export const experiments = sqliteTable('experiments', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  data: text('data').notNull(),
  createdAt: text('created_at').notNull(),
});
export const reviews = sqliteTable(
  'reviews',
  {
    experimentId: text('experiment_id')
      .notNull()
      .references(() => experiments.id),
    taskId: text('task_id').notNull(),
    data: text('data').notNull(),
  },
  (t) => [primaryKey({ columns: [t.experimentId, t.taskId] })],
);

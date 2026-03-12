/**
 * Initial schema migration
 * Creates all tables for Family Court v1.0
 *
 * Note on circular reference: users.family_id → families.id AND families.admin_id → users.id
 * Solution: create both tables without FK first, then add FK constraints via ALTER TABLE.
 */

exports.up = async function (knex) {
  // 1. Enable pgcrypto for gen_random_uuid()
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  // 2. families (no FK to users yet)
  await knex.schema.createTable('families', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 50).notNullable();
    t.string('invite_code', 10).unique().notNullable();
    t.uuid('admin_id'); // FK added below after users table
    t.integer('timeout_mins').defaultTo(120);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // 3. users (with FK to families)
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('phone', 20).unique().notNullable();
    t.string('nickname', 30).notNullable();
    t.text('avatar_url');
    t.uuid('family_id').references('id').inTable('families').onDelete('SET NULL');
    t.string('family_alias', 20);
    t.string('status', 10).defaultTo('idle'); // idle | busy
    t.string('fcm_token', 255); // Firebase push token
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // 4. Add FK: families.admin_id → users.id
  await knex.schema.alterTable('families', (t) => {
    t.foreign('admin_id').references('id').inTable('users').onDelete('SET NULL');
  });

  // 5. cases
  await knex.schema.createTable('cases', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('family_id').notNullable().references('id').inTable('families').onDelete('CASCADE');
    t.string('case_number', 20).unique().notNullable();
    t.string('status', 30).notNullable().defaultTo('pending_judge_accept');
    // pending_judge_accept | pending_defendant | pending_inquiry |
    // pending_fact_finding | pending_claim | pending_defendant_response |
    // mediation | closed | archived | withdrawn
    t.string('category', 20).notNullable();
    // chores | spending | education | verbal | other

    t.uuid('plaintiff_id').references('id').inTable('users').onDelete('SET NULL');
    t.uuid('defendant_id').references('id').inTable('users').onDelete('SET NULL');
    t.uuid('judge_id').references('id').inTable('users').onDelete('SET NULL');
    t.boolean('is_ai_judge').defaultTo(false);

    t.text('plaintiff_statement');
    t.integer('plaintiff_emotion'); // 1-10
    t.text('defendant_statement');
    t.integer('defendant_emotion'); // 1-10

    t.text('fact_finding');
    t.boolean('fact_finding_is_ai').defaultTo(false);

    t.text('plaintiff_claim');
    t.string('claim_category', 20); // apology | behavior | compensation | agreement | other

    // defendant response: accept | partial | reject
    t.string('defendant_response', 20);
    t.text('defendant_response_reason');

    t.text('mediation_plan');
    t.boolean('mediation_plan_is_ai').defaultTo(false);

    // plaintiff mediation response: accept | reject
    t.string('plaintiff_mediation_response', 20);
    t.string('defendant_mediation_response', 20);

    t.text('verdict');

    t.boolean('is_public').defaultTo(false);
    t.boolean('withdrawn').defaultTo(false);
    t.text('withdraw_reason');

    t.timestamp('ai_takeover_at', { useTz: true });
    t.timestamp('deadline_answer', { useTz: true }); // defendant answer deadline
    t.timestamp('ai_warning_sent_at', { useTz: true }); // track if 5-min warning sent

    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // 6. inquiries (法官问询记录)
  await knex.schema.createTable('inquiries', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('case_id').notNullable().references('id').inTable('cases').onDelete('CASCADE');
    t.integer('round').notNullable(); // 1-3
    t.string('type', 20).notNullable();
    // private_plaintiff | private_defendant | confrontation
    t.text('question').notNullable();
    t.string('target', 20).notNullable(); // plaintiff | defendant
    t.text('quoted_text'); // for confrontation: the quoted passage
    t.text('answer');
    t.boolean('is_visible_to_both').defaultTo(false); // true after confrontation
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('answered_at', { useTz: true });
  });

  // 7. case_fact_objections (双方对事实认定的异议标记，不影响流程)
  await knex.schema.createTable('fact_objections', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('case_id').notNullable().references('id').inTable('cases').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('reason');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['case_id', 'user_id']); // one objection per user per case
  });

  // 8. notifications
  await knex.schema.createTable('notifications', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('case_id').references('id').inTable('cases').onDelete('SET NULL');
    t.string('type', 50).notNullable();
    t.text('title').notNullable();
    t.text('body').notNullable();
    t.boolean('read').defaultTo(false);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // 9. refresh_tokens (JWT refresh token 黑名单/存储)
  await knex.schema.createTable('refresh_tokens', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('token').notNullable().unique();
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.boolean('revoked').defaultTo(false);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // 10. Indexes for performance
  await knex.raw('CREATE INDEX idx_cases_family_id ON cases(family_id)');
  await knex.raw('CREATE INDEX idx_cases_status ON cases(status)');
  await knex.raw('CREATE INDEX idx_cases_plaintiff_id ON cases(plaintiff_id)');
  await knex.raw('CREATE INDEX idx_cases_defendant_id ON cases(defendant_id)');
  await knex.raw('CREATE INDEX idx_cases_judge_id ON cases(judge_id)');
  await knex.raw('CREATE INDEX idx_inquiries_case_id ON inquiries(case_id)');
  await knex.raw('CREATE INDEX idx_notifications_user_id ON notifications(user_id)');
  await knex.raw('CREATE INDEX idx_notifications_read ON notifications(user_id, read)');
  await knex.raw('CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('fact_objections');
  await knex.schema.dropTableIfExists('inquiries');
  await knex.schema.dropTableIfExists('cases');
  // Drop FK before dropping families
  await knex.schema.alterTable('families', (t) => {
    t.dropForeign('admin_id');
  });
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('families');
};

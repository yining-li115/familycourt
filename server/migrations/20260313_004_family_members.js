/**
 * Add family_members junction table for multi-family support.
 * Migrates existing users.family_id + family_alias data.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('family_members', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users');
    table.uuid('family_id').notNullable().references('id').inTable('families');
    table.string('alias', 20);
    table.timestamp('joined_at').defaultTo(knex.fn.now());
    table.unique(['user_id', 'family_id']);
  });

  // Migrate existing data from users table
  await knex.raw(`
    INSERT INTO family_members (user_id, family_id, alias, joined_at)
    SELECT id, family_id, family_alias, COALESCE(updated_at, created_at)
    FROM users
    WHERE family_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('family_members');
};

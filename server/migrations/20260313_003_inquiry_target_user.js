/**
 * Add target_user_id to inquiries for multi-party support.
 * Each inquiry record targets a specific user (not just 'plaintiff'/'defendant' role).
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('inquiries', (table) => {
    table.uuid('target_user_id').nullable().references('id').inTable('users');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('inquiries', (table) => {
    table.dropColumn('target_user_id');
  });
};

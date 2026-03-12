/**
 * Add case_parties table for multi-plaintiff / multi-defendant support.
 * The original plaintiff_id / defendant_id columns are kept for backward compatibility
 * and represent the "primary" plaintiff / defendant.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('case_parties', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('case_id').notNullable().references('id').inTable('cases').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.enu('role', ['plaintiff', 'defendant']).notNullable();
    t.text('statement');           // each party's own statement
    t.integer('emotion');          // emotion 1-10
    t.timestamp('statement_at');   // when statement was submitted
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.unique(['case_id', 'user_id']); // one role per person per case
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('case_parties');
};

exports.up = function (knex) {
  return knex.schema.table("users", function (table) {
    table
      .integer("from_block_height")
      .defaultTo(0, { constraintName: "block_height_default" });
  });
};

exports.down = function (knex) {
  return knex.schema.table("users", function (table) {
    table.dropColumn("from_block_height");
  });
};

exports.config = { transaction: true };

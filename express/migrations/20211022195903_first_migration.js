exports.up = function (knex) {
  return knex.schema
    .createTable("users", function (table) {
      table.string("twitter_id", 255).notNullable().unique().primary();
      table.string("twitter_handle", 255).notNullable().unique();
      table.string("arweave_address", 255);
      table.text("photo_url", 255);
      table.text("oauth_access_token");
      table.text("oauth_access_token_iv");
      table.text("oauth_secret_token");
      table.text("oauth_secret_token_iv");
      table.boolean("is_subscribed");
      table.timestamps(true, true);
      table.unique(["twitter_id", "arweave_address"], {
        indexName: "users_composite_index",
        deferrable: "deferred",
      });
    })
    .createTable("tweets", function (table) {
      table.string("tweet_id").notNullable().primary();
      table.string("twitter_id", 255);
      table.foreign("twitter_id").references("users.twitter_id");
      table.string("arweave_tx_id", 255).notNullable();
    });
};

exports.down = function (knex) {
  return knex.schema.dropTable("tweets").dropTable("users");
};

exports.config = { transaction: true };

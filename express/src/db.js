require("dotenv").config();

const knex = require("knex")({
  client: "pg",
  version: "12",
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
});

module.exports = {
  fetchAllSubscribedUsers: async () => {
    return await knex.select().table("users").where("is_subscribed", true);
  },

  fetchUserInfoByTwitterID: async (twitterID) => {
    return await knex
      .select()
      .table("users")
      .where("twitter_id", twitterID)
      .first();
  },

  getTweet: async (txID) => {
    return await knex
      .select()
      .table("tweets")
      .where("arweave_tx_id", txID)
      .first();
  },

  createNewUser: async (user) => {
    return await knex("users")
      .insert(user)
      .returning([
        "twitter_id",
        "twitter_handle",
        "arweave_address",
        "is_subscribed",
        "photo_url",
      ]);
  },

  updateUserInfo: async (user) => {
    return await knex("users").insert(user).onConflict("twitter_id").merge();
  },

  saveTweetInfo: async (user, arweave_tx_id, tweetID) => {
    return await knex("tweets").insert({
      twitter_id: user.twitter_id,
      tweet_id: tweetID,
      arweave_tx_id: arweave_tx_id,
    });
  },
};

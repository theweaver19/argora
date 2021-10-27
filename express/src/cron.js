const cron = require("node-cron");
let arweaveHelper = require("./arweave_helper");
const axios = require("axios").default;
const db = require("./db");
const graphql = require("graphql-request");
require("dotenv").config();
const oauthCallback = process.env.FRONTEND_URL;
const oauth = require("./lib/oauth-promise")(oauthCallback);

function formatToTwitter(message) {
  let splitMsg = message.match(/[\s\S]{1,274}/g);
  let tweets = [];

  if (splitMsg.length === 1) {
    tweets = splitMsg;
  } else {
    for (var i = 0; i < splitMsg.length; i++) {
      tweets.push(i + 1 + "/" + splitMsg.length + " " + splitMsg[i]);
    }
  }

  return tweets;
}

async function postToTwitter(
  message,
  arweaveTxID,
  oauth_access_token,
  oauth_access_token_secret
) {
  let tweets = formatToTwitter(message);

  tweets.push(
    "Tweet originally pubished on @ArgoraTeam at https://arweave.net/MHCq_KwBflnpMkZQA6z3B7izxWyoArT2aE4c8VcpnDQ/thread/" +
      arweaveTxID
  );

  let lastTweetID = "";
  let firstTweetID = "";
  for (const status of tweets) {
    const response = await oauth.postProtectedResource(
      `https://api.twitter.com/1.1/statuses/update.json`,
      {
        status: status,
        in_reply_to_status_id: lastTweetID,
        auto_populate_reply_metadata: true,
      },
      oauth_access_token,
      oauth_access_token_secret
    );

    let tweet = JSON.parse(response.data);
    if (lastTweetID === "") {
      firstTweetID = tweet.id_str;
    }
    lastTweetID = tweet.id_str;
  }

  return { id_str: firstTweetID };
}

module.exports = {
  start: () => {
    // Schedule tasks to be run on the server.
    cron.schedule("* * * * *", async function () {
      console.log("running a task every minute");

      // for every subscribed user we
      let subscribers = await db.fetchAllSubscribedUsers();

      for (sub of subscribers) {
        try {
          // fetch the latest argora messages
          let res = await graphql.request(
            arweaveHelper.ARWEAVE_GQL_ENDPOINT,
            arweaveHelper.argoraQuery([sub.arweave_address])
          );

          // we reverse the array to start with the older message first
          let txs = res.transactions.edges.reverse();

          for (tx of txs) {
            let txID = tx.node.id;
            if ((await db.getTweet(txID)) === undefined) {
              let newRes = await axios.get(
                arweaveHelper.ARWEAVE_GATEWAY + "/" + txID
              );

              let message = newRes.data.text;

              console.debug("uploading message", message);

              // TODO we need to break up the message into possibly many tweets!
              let twitterRes = await postToTwitter(
                message,
                txID,
                sub.oauth_access_token,
                sub.oauth_secret_token
              );
              console.debug("uploaded to twitter", message);

              console.debug("saving message");
              await db.saveTweetInfo(sub, txID, twitterRes.id_str);
              console.debug("message saved");
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
    });
  },
};

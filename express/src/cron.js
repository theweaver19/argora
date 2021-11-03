const cron = require("node-cron");
const arweaveHelper = require("./arweave_helper");
const axios = require("axios").default;
const db = require("./db");
const graphql = require("graphql-request");
require("dotenv").config();
const oauthCallback = process.env.FRONTEND_URL;
const oauth = require("./lib/oauth-promise")(oauthCallback);
const { decrypt } = require("./crypto");
const Codebird = require("codebird");

var cb = new Codebird();
cb.setConsumerKey(process.env.CONSUMER_KEY, process.env.CONSUMER_SECRET);

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

function uploadMedia(cb, params) {
  return new Promise((resolve, reject) => {
    cb.__call("media_upload", params, function (reply, rate, err) {
      if (err !== undefined) {
        reject(err);
      }
      resolve(reply);
    });
  });
}

async function postToTwitter(
  message,
  pictures,
  arweaveTxID,
  oauth_access_token,
  oauth_access_token_secret
) {
  cb.setToken(oauth_access_token, oauth_access_token_secret);
  let mediaIDs = [];
  for (picTxID of pictures) {
    // we fetch from arweave
    let img = await axios.get(arweaveHelper.ARWEAVE_GATEWAY + "/" + picTxID, {
      responseType: "arraybuffer",
    });

    var params = {
      media_data: Buffer.from(img.data, "binary").toString("base64"),
      media_category: "tweet_image",
    };

    let reply = await uploadMedia(cb, params);

    mediaIDs.push(reply.media_id_string);
  }

  let tweets = formatToTwitter(message);

  tweets.push(
    "Tweet originally pubished on @ArgoraTeam at https://arweave.net/MHCq_KwBflnpMkZQA6z3B7izxWyoArT2aE4c8VcpnDQ/thread/" +
      arweaveTxID
  );

  let lastTweetID = "";
  let firstTweetID = "";
  for (const status of tweets) {
    let mediaIdsJoined = "";
    if (firstTweetID === "") {
      mediaIdsJoined = mediaIDs.join(",");
    } else {
      mediaIdsJoined = "";
    }
    const response = await oauth.postProtectedResource(
      `https://api.twitter.com/1.1/statuses/update.json`,
      {
        status: status,
        in_reply_to_status_id: lastTweetID,
        auto_populate_reply_metadata: true,
        media_ids: mediaIdsJoined,
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
    cron.schedule(process.env.CRON_SCHEDULE, async function () {
      console.log("running Argora to Twitter task");

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

              if (message === undefined) {
                continue;
              }
              let pictures =
                newRes.data.pictures === undefined ? [] : newRes.data.pictures;

              console.debug("uploading message", message);

              let oauthAccessToken = decrypt(
                sub.oauth_access_token,
                sub.oauth_access_token_iv
              );
              let oauthSecretToken = decrypt(
                sub.oauth_secret_token,
                sub.oauth_secret_token_iv
              );
              let twitterRes = await postToTwitter(
                message,
                pictures,
                txID,
                oauthAccessToken,
                oauthSecretToken
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

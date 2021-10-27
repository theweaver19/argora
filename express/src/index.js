const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const argoraCron = require("./cron");
const db = require("./db");
const app = express();
const port = 3000;
require("dotenv").config();
const oauthCallback = process.env.FRONTEND_URL;
const oauth = require("./lib/oauth-promise")(oauthCallback);
const OAUTH_COOKIE = "oauth_token";
const USER_COOKIE = "user_cookie";
const Arweave = require("arweave");
const path = require("path");

const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

app.use(bodyParser.json());
app.use(cookieParser());
app.use(morgan("combined"));

const router = express.Router();

function getCookie(req, cookieName) {
  let cookies = req.cookies[cookieName];
  if (Array.isArray(cookies)) {
    return cookies[0];
  } else return cookies;
}

//OAuth Step 1
router.post("/twitter/oauth/request_token", async (req, res) => {
  try {
    const { oauth_token, oauth_token_secret, results } =
      await oauth.getOAuthRequestToken();

    if (results.oauth_callback_confirmed !== "true") {
      res.status(500).json({});
    }

    res.cookie(OAUTH_COOKIE, oauth_token, {
      maxAge: 15 * 60 * 1000, // 15 minutes
      secure: true,
      httpOnly: true,
      sameSite: true,
    });

    res.json({ oauth_token });
  } catch (e) {
    console.error(e);
    res.status(500).json({});
  }
});

//OAuth Step 3
router.post("/twitter/oauth/access_token", async (req, res) => {
  try {
    const { oauth_token: req_oauth_token, oauth_verifier } = req.body;
    const oauth_token = req.cookies[OAUTH_COOKIE];

    if (oauth_token !== req_oauth_token) {
      res.status(403).json({ message: "Request tokens do not match" });
      return;
    }

    const { oauth_access_token, oauth_access_token_secret } =
      await oauth.getOAuthAccessToken(oauth_token, "", oauth_verifier);

    const response = await oauth.getProtectedResource(
      "https://api.twitter.com/1.1/account/verify_credentials.json",
      "GET",
      oauth_access_token,
      oauth_access_token_secret
    );

    let twitterUserData = JSON.parse(response.data);

    let userInfo = await db.fetchUserInfoByTwitterID(twitterUserData.id_str);

    if (userInfo === undefined) {
      userInfo = await db.createNewUser({
        twitter_id: twitterUserData.id_str,
        twitter_handle: twitterUserData.screen_name,
        photo_url: twitterUserData.profile_image_url_https,
        is_subscribed: false,
        oauth_access_token,
        oauth_secret_token: oauth_access_token_secret,
      });
    }

    res.cookie(USER_COOKIE, userInfo, {
      maxAge: 15 * 60 * 1000, // 15 minutes
      secure: true,
      httpOnly: true,
      sameSite: true,
    });

    res.status(200).json({
      twitter_id: userInfo.twitter_id,
      twitter_handle: userInfo.twitter_handle,
      arweave_address: userInfo.arweave_address,
      is_subscribed: userInfo.is_subscribed,
      photo_url: userInfo.photo_url,
    });
  } catch (error) {
    console.error(error);
    res.status(403).json({ message: "Missing access token" });
  }
});

//Authenticated resource access
router.get("/twitter/users/profile_banner", async (req, res) => {
  try {
    const user = getCookie(req, USER_COOKIE);

    let userInfo = await db.fetchUserInfoByTwitterID(user.twitter_id);

    res.status(200).json({
      twitter_id: userInfo.twitter_id,
      twitter_handle: userInfo.twitter_handle,
      arweave_address: userInfo.arweave_address,
      is_subscribed: userInfo.is_subscribed,
      photo_url: userInfo.photo_url,
    });
  } catch (error) {
    console.log(error);
    res.status(403).json({ message: "Missing, invalid, or expired tokens" });
  }
});

router.post("/twitter/subscribe", async (req, res) => {
  try {
    let data = req.body;
    const user = getCookie(req, USER_COOKIE);

    let parsedTx = arweave.transactions.fromRaw(JSON.parse(data.tx));
    console.log(Arweave.utils.bufferToString(parsedTx.data));
    console.log(user);
    if (
      Arweave.utils.bufferToString(parsedTx.data) !==
      `{twitter_id: ${user.twitter_id}}`
    ) {
      res.status(403).json({ message: "Invalid data signed" });
      return;
    }

    let sigOk = await arweave.transactions.verify(parsedTx);

    if (!sigOk) {
      res.status(403).json({ message: "Invalid signature" });
      return;
    }

    let address = await arweave.wallets.ownerToAddress(parsedTx.owner);

    user.arweave_address = address;
    user.is_subscribed = true;

    await db.updateUserInfo(user);

    res.status(200).json({ subscribed: true });
  } catch (error) {
    console.error(error);
    res.status(403).json({ message: "Missing, invalid, or expired tokens" });
  }
});

router.post("/twitter/unsubscribe", async (req, res) => {
  try {
    const user = getCookie(req, USER_COOKIE);

    user.is_subscribed = false;

    await db.updateUserInfo(user);
    res.cookie(USER_COOKIE, user, {
      maxAge: 15 * 60 * 1000, // 15 minutes
      secure: true,
      httpOnly: true,
      sameSite: true,
    });

    res.json({ subscribed: false });
    return;
  } catch (error) {
    res.status(403).json({ message: "Missing, invalid, or expired tokens" });
  }
});

router.post("/twitter/logout", async (req, res) => {
  try {
    const user = getCookie(req, USER_COOKIE);

    user.oauth_access_token = "";
    user.oauth_secret_token = "";

    await db.updateUserInfo(user);

    res.cookie(OAUTH_COOKIE, {}, { maxAge: -1 });
    res.cookie(USER_COOKIE, {}, { maxAge: -1 });
    res.json({ success: true });
  } catch (error) {
    res.status(403).json({ message: "Missing, invalid, or expired tokens" });
  }
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, "../../react/build")));

app.get("*", (req, res) => {
  console.log(path);
  res.sendFile(path.join(__dirname + "/../../react/build/index.html"));
});

app.use("/api", router);

argoraCron.start();

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

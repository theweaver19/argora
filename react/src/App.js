import logo from "./argora.png";
import "./App.css";
import axios from "axios";
import { useState, useEffect } from "react";
import queryString from "query-string";
import Arweave from "arweave";

const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

const apiPath = "/api";

const permissions = [
  "ACCESS_ADDRESS",
  "ACCESS_ALL_ADDRESSES",
  "ACCESS_PUBLIC_KEY",
  "SIGNATURE",
  "SIGN_TRANSACTION",
];

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    +localStorage.getItem("expiry") > Date.now()
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [name, setName] = useState();
  const [imageUrl, setImageUrl] = useState();
  const [currentArconnectAddress, setCurrentArconnectAddress] = useState("");
  const [userInfo, setUserInfo] = useState({});
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    window.addEventListener("arweaveWalletLoaded", () => {
      window.addEventListener("walletSwitch", (e) => {
        const newAddress = e.detail.address;
        setCurrentArconnectAddress(newAddress);
      });

      window.arweaveWallet.getPermissions().then((a) => {
        if (a.includes("ACCESS_ADDRESS")) {
          window.arweaveWallet.getActiveAddress().then((address) => {
            setCurrentArconnectAddress(address);
          });
        }
      });
    });
  }, []);

  useEffect(() => {
    (async () => {
      const { oauth_token, oauth_verifier } = queryString.parse(
        window.location.search
      );

      if (oauth_token && oauth_verifier && !isLoggedIn) {
        try {
          //Oauth Step 3
          let res = await axios({
            url: `${apiPath}/twitter/oauth/access_token`,
            method: "POST",
            data: { oauth_token, oauth_verifier },
          });
          let data = res.data;

          setIsLoggedIn(true);
          localStorage.setItem("expiry", data.expiry);
          setName(data.twitter_handle);
          setImageUrl(data.photo_url);
          setUserInfo(data);
          setIsSubscribed(data.is_subscribed);

          window.location.search = "";
        } catch (error) {
          console.error(error);
        }
      }
    })();
  }, []);

  const refreshUser = async () => {
    let res = await axios({
      url: `${apiPath}/twitter/users/profile_banner`,
      method: "GET",
    });
    let data = res.data;
    setIsLoggedIn(true);
    setName(data.twitter_handle);
    setImageUrl(data.photo_url);
    setUserInfo(data);
    setIsSubscribed(data.is_subscribed);
  };

  useEffect(() => {
    (async () => {
      try {
        if (isLoggedIn) {
          await refreshUser();
        }
      } catch (error) {
        console.error(error);
      }
    })();
  }, []);

  const login = () => {
    (async () => {
      try {
        //OAuth Step 1
        const response = await axios({
          url: `${apiPath}/twitter/oauth/request_token`,
          method: "POST",
        });

        const { oauth_token } = response.data;
        //Oauth Step 2
        window.location.href = `https://api.twitter.com/oauth/authenticate?oauth_token=${oauth_token}`;
      } catch (error) {
        console.error(error);
      }
    })();
  };

  const logout = () => {
    (async () => {
      try {
        localStorage.clear();
        setIsLoggedIn(false);
        await axios({
          url: `${apiPath}/twitter/logout`,
          method: "POST",
        });
      } catch (error) {
        console.error(error);
      }
    })();
  };

  const subscribe = () => {
    (async () => {
      setIsSubscribing(true);
      try {
        let tx = await arweave.createTransaction({
          data: Buffer.from(`{twitter_id: ${userInfo.twitter_id}}`, "utf8"),
        });

        await arweave.transactions.sign(tx);
        let res = await axios({
          url: `${apiPath}/twitter/subscribe`,
          method: "POST",
          data: { tx: JSON.stringify(tx) },
        });
        setIsSubscribed(res.data.subscribed);

        await refreshUser();
        setIsSubscribing(false);
      } catch (error) {
        console.error(error);
        setIsSubscribing(false);
      }
    })();
  };

  const unsubscribe = async (body) => {
    try {
      let res = await axios({
        url: `${apiPath}/twitter/unsubscribe`,
        method: "POST",
        body: "",
      });
      setIsSubscribed(res.data.subscribed);
    } catch (error) {
      console.error(error);
    }
  };

  const arconnectLogin = async () => {
    window.arweaveWallet.connect(permissions).then(() => {
      window.arweaveWallet.getActiveAddress().then((a) => {
        setCurrentArconnectAddress(a);
      });
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <div
          style={{
            display: "flex",
            width: "100%",
            alignContent: "center",
            alignItems: "center",
          }}
        >
          <p
            style={{
              marginLeft: "20px",
            }}
          >
            <img src={logo} className="App-logo" alt="logo" /> Bridge
          </p>
          <p style={{ marginLeft: "auto" }}>
            {isLoggedIn && (
              <button className="signout-btn" onClick={logout}>
                Sign Out
              </button>
            )}
          </p>
        </div>
      </header>

      <div className="main-app">
        {isLoggedIn && (
          <div>
            <div>
              <img alt="User profile" src={imageUrl} />
            </div>
            <div>Hello {name}!</div>
            <br />
            <br />
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <div style={{ marginRight: "10px" }}>Step 1:</div>
          <div>
            {isLoggedIn ? (
              <div>✅</div>
            ) : (
              <div>
                <img
                  className="signin-btn"
                  onClick={login}
                  alt="Twitter login button"
                  src="https://assets.klaudsol.com/twitter.png"
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <div style={{ marginRight: "10px" }}>Step 2:</div>
            {currentArconnectAddress !== "" ? (
              <div>✅</div>
            ) : (
              <button className="signout-btn" onClick={arconnectLogin}>
                Connect to Arconnect
              </button>
            )}
          </div>
        </div>
        {currentArconnectAddress !== "" && (
          <div>Your current Arconnect Address is {currentArconnectAddress}</div>
        )}

        {isLoggedIn && (
          <div>
            <div>
              {isSubscribed ? (
                <button className="unsubscribe-btn" onClick={unsubscribe}>
                  Unsubscribe
                </button>
              ) : (
                <div>
                  Step 3:
                  <button
                    className="subscribe-btn"
                    onClick={subscribe}
                    disabled={isSubscribing}
                  >
                    Subscribe to the bridge
                  </button>
                  <br />
                  This will create and sign a transaction with your current
                  twitter ID in the data field.
                  <br /> We do not send that transaction over to the network, we
                  just verify the signature to know that you hold this account.
                  <br />
                  If using Arconnect, tx charges may apply.
                  <br />
                </div>
              )}

              <div>
                <br />
                <br />
                {isSubscribed && (
                  <div
                    style={{
                      backgroundColor: "green",
                      borderRadius: "5px",
                      padding: "10px",
                    }}
                  >
                    Congratulations! Your twitter account is subscribed to the
                    bridge, your Argora messages from {userInfo.arweave_address}{" "}
                    (not replies) will be tweeted out automatically to your
                    twitter account.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

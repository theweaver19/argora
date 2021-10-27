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

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem("isLoggedIn") === "true"
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [name, setName] = useState();
  const [imageUrl, setImageUrl] = useState();
  const [argoraAddress, setArgoraAddress] = useState("");
  const [userInfo, setUserInfo] = useState({});

  useEffect(() => {
    window.addEventListener("arweaveWalletLoaded", () => {
      /** Handle ArConnect load event **/

      window.arweaveWallet.connect([
        "ACCESS_ADDRESS",
        "ACCESS_ALL_ADDRESSES",
        "ACCESS_PUBLIC_KEY",
        "SIGNATURE",
        "SIGN_TRANSACTION",
      ]);

      window.arweaveWallet.getActiveAddress().then((a) => {
        setArgoraAddress(a);
      });
    });

    window.addEventListener("walletSwitch", (e) => {
      const newAddress = e.detail.address;
      setArgoraAddress(newAddress);
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
          setName(data.twitter_handle);
          setImageUrl(data.photo_url);
          setUserInfo(data);
          setIsSubscribed(data.is_subscribed);

          localStorage.setItem("isLoggedIn", "true");
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
        if (localStorage.getItem("isLoggedIn") === "true") {
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
        await axios({
          url: `${apiPath}/twitter/logout`,
          method: "POST",
        });
        setIsLoggedIn(false);
        localStorage.clear();
      } catch (error) {
        console.error(error);
      }
    })();
  };

  const subscribe = () => {
    (async () => {
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
      } catch (error) {
        console.error(error);
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

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
      </header>

      <div className="main-app">
        {!isLoggedIn && (
          <img
            className="signin-btn"
            onClick={login}
            alt="Twitter login button"
            src="https://assets.klaudsol.com/twitter.png"
          />
        )}

        {isLoggedIn && (
          <div>
            <div>
              <img alt="User profile" src={imageUrl} />
            </div>
            <div>Hello {name}!</div>
            <div>
              {isSubscribed ? (
                <button className="unsubscribe-btn" onClick={unsubscribe}>
                  Unsubscribe
                </button>
              ) : (
                <div>
                  Click the below subscribe button. This will create and sign a
                  transaction with your current twitter ID in the data field.
                  <br /> We do not send that transaction over to the network, we
                  just verify the signature to know that you hold this account.
                  <br />
                  If using Arconnect, tx charges may apply.
                  <br />
                  <button className="subscribe-btn" onClick={subscribe}>
                    Subscribe
                  </button>
                </div>
              )}

              <div>
                {isSubscribed &&
                  `Your twitter account is subscribed to the bridge, your Argora messages from address ${userInfo.arweave_address} (not replies) will be tweeted out automatically to your twitter account.`}
              </div>
            </div>
            <button className="signout-btn" onClick={logout}>
              Sign Out
            </button>
          </div>
        )}

        {/* {isLoggedIn && (
          // <div>Your current Arweave address is: {argoraAddress}</div>
        )} */}
      </div>
    </div>
  );
}

export default App;

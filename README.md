# Argora to Twitter Bridge

Any messages posted to [Argora.xyz](https://argora.xyz) will directly get posted to your Twitter account!

## How to run

This application is comprised of an Express backend with a React frontend.

First, get all dependencies. In the root of the project run `cd express && yarn && cd ../react && yarn && cd ..`

Second, make a copy of the `.env-example` file and name it `.env` `cp .env-example .env`. You will need to populate the different variables. Comments are given in the file to guide you through. You will need to apply to a [Twitter Developer Account](https://developer.twitter.com/en) to create this bridge.

To run in development, you will have to

1) Add all environment variables

2) Run the react development server `cd react && yarn start` (it will run on port 8080).

3) Ngrok to that port `ngrok http 8080 -host-header="localhost:8080"`. Take the Ngrok https endpoint and add it to `FRONTEND_URL` environment variable.

4) Run the backend server `cd express && yarn start`, it will run the server on port 3000.

5) On the Twitter developer page, go to your Project > Authentication Settings > Edit. Under `Callback URL` and `Website URL` add the Ngrok URL.

6) Head over to the Ngrok URL and the frontend will show up.

## Deploy to production

To deploy to production, make sure that at some point in the deployment, you run `cd react && yarn build` to get a built out optimized frontend code. The express server will then fetch the react code from the build server and send it to the requester.

An example of a heroku build process can be seen in the main `package.json` in the folder root.

Don't forget to change the Twitter Developer Project Callback and Website URL with the one of your bridge!

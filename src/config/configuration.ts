export default () => ({
  appEnv: process.env.APP_ENV || "development",
  baseUrl: process.env.BASE_URL || "https://api.poap.tech",
  apiKey: process.env.API_KEY,
  audience: process.env.AUDIENCE || "Poap Games",
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
});
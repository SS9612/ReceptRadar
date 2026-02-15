// Load env so EXPO_PUBLIC_* are available when Expo evaluates this config.
// Use .env.example as defaults, then .env to override (so you can use only .env.example if you prefer).
// This makes Azure config available on web (Constants.expoConfig.extra).
require('dotenv').config({ path: '.env.example' });
require('dotenv').config({ path: '.env' });

const appJson = require('./app.json');

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      EXPO_PUBLIC_AZURE_OPENAI_ENDPOINT: process.env.EXPO_PUBLIC_AZURE_OPENAI_ENDPOINT,
      EXPO_PUBLIC_AZURE_OPENAI_API_KEY: process.env.EXPO_PUBLIC_AZURE_OPENAI_API_KEY,
      EXPO_PUBLIC_AZURE_OPENAI_CHAT_DEPLOYMENT: process.env.EXPO_PUBLIC_AZURE_OPENAI_CHAT_DEPLOYMENT,
      EXPO_PUBLIC_AZURE_OPENAI_IMAGE_DEPLOYMENT: process.env.EXPO_PUBLIC_AZURE_OPENAI_IMAGE_DEPLOYMENT,
    },
  },
};

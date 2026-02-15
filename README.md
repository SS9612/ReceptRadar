# ReceptRadar

Recept-app som hjälper dig hitta recept utifrån ingredienser i skafferiet. Skanna streckkoder, lägg till varor och få förslag från **sparade webb-recept** och **AI-genererade recept** (Azure AI Foundry). Recept som genereras med AI sparas lokalt och återanvänds.

## Bygg och publicering

### App-ikon och skärmdumpar

- **Ikon:** `assets/icon.png` (1024×1024 rekommenderas för iOS). Android använder `assets/adaptive-icon.png`.
- **Splash:** `assets/splash-icon.png` (konfigurerat i `app.json`).
- **Screenshots för App Store Connect:** Ta skärmdumpar i simulator eller på fysisk enhet (t.ex. iPhone 6,7"- och 6,5"-enheter). Lägg dem i en mapp eller använd dem direkt i App Store Connect vid “App Preview and Screenshots”.

### Bygg med EAS (Expo Application Services)

1. Installera EAS CLI: `npm install -g eas-cli`
2. Logga in: `eas login`
3. Konfigurera projektet: `eas build:configure` (skapar `eas.json` om det behövs)
4. Bygg för iOS: `eas build --platform ios --profile production` (kräver **Apple Developer Program**, 99 USD/år)
5. Bygg för Android: `eas build --platform android --profile production`

**Staging-build** (testning, fungerar utan betalda utvecklarkonton):

- `npm run build:staging` – bygg för både iOS och Android
- `npm run build:staging:ios` / `npm run build:staging:android` – bygg för en plattform
- **iOS:** Staging bygger en **simulator-build** (kräver inte Apple Developer Program). Ladda ner `.tar.gz` från EAS, packa upp och dra `.app`-filen in i iOS Simulator.
- **Android:** Intern build – installera via nedladdningslänk från EAS (gratis Google-konto räcker).

**Testa staging på din telefon:**

- **Android:** Kör `npm run build:staging:android`. När bygget är klart går du till [expo.dev](https://expo.dev) → ditt projekt → Builds, klickar på bygget och öppnar **nedladdningslänken på din Android-telefon** – installera och testa. Du kan också skicka länken till andra testare.
- **iPhone (med gratis Apple-konto):** EAS-staging bygger bara för simulator, så du kan inte installera den färdiga bygget på en riktig enhet utan betalt utvecklarkonto. För att köra appen på din iPhone: koppla telefonen med USB, kör `npx expo run:ios --device` (kräver Xcode och att du loggat in med ditt Apple ID i Xcode). Då byggs och installeras appen direkt på din telefon.

### Ladda upp till App Store Connect

- **iOS:** Efter att bygget är klart kan du antingen ladda upp via EAS Submit (`eas submit --platform ios`) eller ladda ner `.ipa` från EAS och ladda upp manuellt i App Store Connect → TestFlight / App Store.
- **Android:** Bygg en AAB (Android App Bundle) med EAS och ladda upp till Google Play Console.

### Integritet

Appen samlar inte in personuppgifter. Se **PRIVACY.md** för fullständig integritetspolicy och för att fylla i “App Privacy” i App Store Connect.

## Utveckling

- `npm start` – starta Expo
- `npm run ios` / `npm run android` – köra på simulator/enhet
- Receptförslag kommer från **sparade webb-recept** och **AI-genererade recept**. Använd **Generera recept med AI** (kräver Azure-konfiguration) eller **Sök på webben** för fler alternativ.

## Miljövariabler

- **Azure AI Foundry (för “Generera recept med AI”):** Appen använder Azure OpenAI **Responses API** (sökväg `/openai/responses`, api-version `2025-04-01-preview`). Sätt i `.env` eller EAS-miljö:
  - `EXPO_PUBLIC_AZURE_OPENAI_ENDPOINT` – endast bas-URL (t.ex. `https://din-resurs.cognitiveservices.azure.com`, utan avslutande snedstreck)
  - `EXPO_PUBLIC_AZURE_OPENAI_API_KEY` – API-nyckel (håll hemlig, committa aldrig)
  - `EXPO_PUBLIC_AZURE_OPENAI_CHAT_DEPLOYMENT` – deploymentsnamn (t.ex. `gpt-5-mini`)
  - Valfritt: `EXPO_PUBLIC_AZURE_OPENAI_IMAGE_DEPLOYMENT` för att generera en bild per recept (t.ex. `dall-e-3` om du har distribuerat DALL·E 3).

  Se `.env.example` för mall. Utan dessa variabler visas inte knappen “Generera recept med AI”; sparade webb-recept fungerar som vanligt.

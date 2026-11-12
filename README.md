# GromCAL

Prehrana, treninzi i osobni napredak na jednom mjestu. Sučelje je na hrvatskom jeziku.

## Preuzimanje

Android APK nalazi se u [najnovijem GitHub izdanju](https://github.com/WizzyAE/GromCAL/releases/latest).

## Prvo pokretanje — vlastiti API ključ

1. Odaberi **OpenAI** ili **Google Gemini**.
2. Unesi svoj API ključ i odaberi želiš li ga zapamtiti na tom uređaju.
3. Pritisni **Provjeri i poveži**. Aplikacija provjerava dostupne modele i šalje kratak testni AI zahtjev.
4. Nakon uspješne provjere otvara se aplikacija. Ključ kasnije mijenjaš u **Profil → Tvoj API ključ**.

Ključevi: [OpenAI](https://platform.openai.com/api-keys) · [Gemini](https://aistudio.google.com/apikey).

**U aplikaciji nema ugrađenog API ključa autora.** Koristi se isključivo ključ koji unese korisnik. Zahtjevi idu izravno odabranom AI servisu. Troškove, kvote i dozvole određuje korisnikov API račun. Provjera veze također može biti naplaćena.

Ako uključiš pamćenje, ključ se sprema u lokalnu pohranu aplikacije na uređaju; koristi samo uređaj kojem vjeruješ. Bez pamćenja ključ ostaje u memoriji do zatvaranja aplikacije. Privatni podaci, lokalne sigurnosne kopije i ključevi za potpisivanje nisu dio ovog repozitorija.

## Lokalno pokretanje

Potreban je Python; Node.js i npm trebaju samo za razvoj i testove.

```powershell
powershell -ExecutionPolicy Bypass -File .\Start-GromCAL.ps1
```

Otvori <http://127.0.0.1:5173>. Za zaustavljanje pritisni `Ctrl+C`.

## Razvoj

```powershell
npm ci
npm run build
npm test
```

- `src/api-setup.js` — obavezan unos, provjera, pohrana i korištenje korisnikovog ključa.
- `src/training-charts.js` i `src/training-ui.css` — prilagodljiv prikaz grafova treninga.
- `scripts/build-training-ui.mjs` — izrađuje web paket iz sačuvanog, očišćenog paketa aplikacije.
- `dist/` — web aplikacija spremna za posluživanje.
- `integrations/` — obavijest za Gromify i Gromflix koja vodi na ovaj repozitorij. Prikazuje se tek nakon objave GitHub izdanja i pamti zatvaranje na uređaju.

Projekt je obnovljen iz instalirane verzije. Izvorne React/TypeScript komponente ostatka aplikacije nisu bile dostupne, pa su izmjene izdvojene u čitljive module i ugrađuju se ponovljivom skriptom. Preostali web kod ostaje u obnovljenom JavaScript paketu.

## Provjere

Testovi pokrivaju početni unos oba API ključa, nevažeći ključ, kvotu, analizu treninga, izolaciju servisa, spremanje profila, pamćenje i ključ samo u memoriji. Koriste lažne ključeve i simulirane API odgovore; nikad autorov ključ.

UI provjere pokrivaju zaslone širine 320–768 px, do 300 vježbi, 365 dana povijesti i spremanje treninga. Za testove se koristi instalirani Chrome/Edge ili Playwright Chromium. Drugi preglednik može se zadati varijablom `GROMCAL_BROWSER`.

`npm run check:public` provjerava javne datoteke na ugrađene API ključeve. `npm run test:announcements` provjerava obavijest u izgrađenim susjednim projektima Gromify i Gromflix, ako su dostupni.

## Android paket

`scripts/build-apk.py` zamjenjuje web sadržaj lokalnog osnovnog APK-a, postavlja verziju 1.2 (kod 2), provjerava raspakirane datoteke, poravnava i potpisuje paket. Osnovni APK, Android Build Tools, JDK i vlastiti keystore moraju biti lokalni ulazi. Lozinka keystorea čita se iz `GROMCAL_KEYSTORE_PASSWORD`. Ti ulazi i izgrađeni paketi isključeni su iz Gita.

```powershell
python scripts/build-apk.py --base putanja-do-osnovnog.apk --keystore putanja-do-keystorea --build-tools putanja-do-android-build-tools --java-home putanja-do-jdk
```

Dokumentacija API-ja: [OpenAI autentifikacija](https://developers.openai.com/api/reference/overview), [OpenAI modeli](https://developers.openai.com/api/reference/resources/models/methods/list), [Gemini API](https://aistudio.google.com/api-reference).

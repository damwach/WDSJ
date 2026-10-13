# SKYLIFT 3D — 0.4 / iteracja 01

Laboratorium najazdu i wybicia. Three.js + TypeScript + Vite; bez tekstur obrazkowych.

## Uruchomienie

Node.js 22+:

```sh
npm ci --cache /workspace/.npm-cache
npm run dev -- --port 5173
```

Rozpocznij najazd lub wybierz pokaz techniki. W ostatnich 8 m przytrzymaj oba przyciski myszy i przesuń mysz w górę (około 120 px daje pełny cel wyprostu). Kierunek boczny przesuwa modelowaną linię reakcji, szybkość gestu zwiększa mimośród siły. R resetuje, spacja zatrzymuje symulację. Kamera boczna służy analizie ruchu.

## Kontrola jakości

```sh
npm run build
npm test
npm run test:visual
```

Test używa systemowego /usr/bin/chromium (lub CHROMIUM_PATH).

Zrzuty kolejnych faz trafiają do artifacts/. Test przeglądarkowy sprawdza błędy konsoli, przejście najazd–lot i długości kości. To test dymny z zapisem obrazów, nie automatyczne porównanie z zatwierdzonym wzorcem.

## Zakres i ograniczenia

Pierwsza iteracja koncentruje się na proporcjach, stałych długościach segmentów, płynnym wyproście i fragmencie skoczni. Wymiary: udo 44 cm, podudzie 43 cm, tułów 53 cm, narty około 2.6 m. Profil jest projektowym przybliżeniem, nie certyfikowaną skocznią FIS.

Fizyka jest deterministyczna dla identycznych próbek na identycznych krokach. Wejście na żywo trafia do najbliższego kroku, bez pełnego systemu replayu. Przerwy klatek powyżej 250 ms są ograniczane. Rendering nie interpoluje stanu między krokami.

Wyprost jest ograniczonym napędem sprężysto-tłumiącym, a impuls normalny i moment bazują na parametrycznym ruchu środka masy. To nie pełna dynamika wieloczłonowa; brak ograniczeń siły mięśni i zmiennego momentu bezwładności. Wyprost nie oznacza niezależnie wyliczonej siły reakcji zeskoku. Duży gest zmienia moment, bez zaprogramowanego salta.

Lot to model 2D sił z prostym bocznym balansem; wiatr jest parametrem modelu, bez UI. Współczynniki aerodynamiczne nie zostały skalibrowane eksperymentalnie. V jest animowany; nie ma niezależnej dynamiki nart. Kontakt i upadek to tymczasowa klasyfikacja i końcowa poza, bez telemarku, amortyzacji i ragdolla. Pełne lądowanie należy do następnej iteracji.

Analiza poprzedniej wersji: [docs/REVIEW-v03.md](docs/REVIEW-v03.md).

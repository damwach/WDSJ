# SKYLIFT 3D — 0.5 / iteracja 02

Laboratorium najazdu i wybicia. Three.js + TypeScript + Vite; bez tekstur obrazkowych.

## Podgląd online: GitHub Pages

Workflow `.github/workflows/pages.yml` publikuje grę po każdym pushu do `main`, po instalacji z lockfile, testach fizyki i buildzie. Docelowy adres to `https://damwach.github.io/WDSJ/` (działa po udanym wdrożeniu).

Jednorazowe ustawienie repozytorium w GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Jeśli pierwszy workflow zakończył się przed włączeniem Pages, otwórz **Actions → Publish SKYLIFT to GitHub Pages → Run workflow**, wybierając gałąź `main`.

`npm run build:pages` ustawia ścieżki zasobów na `/WDSJ/`. Zwykłe `npm run build` pozostaje dostępne do hostingu w katalogu głównym, np. Vercel (Build command: `npm run build`, Output directory: `dist`). Vercel wymaga osobnego podłączenia repozytorium do projektu.

Do pracy lokalnej: sklonuj repozytorium, wejdź do jego folderu, uruchom `npm ci` i `npm run dev`. Lokalny Codex może edytować i uruchamiać tę samą wersję. Przed wysłaniem zmian wykonaj build oraz odpowiednie testy.

## Uruchomienie bez instalacji

Pobierz `artifacts/SKYLIFT-0.5.html` na swój komputer i otwórz go w Chrome lub Edge. Plik zawiera cały kod, Three.js i style. Działa bez serwera, internetu i Node.js. Kliknij „Pokaz techniki”, aby sprawdzić animację.

Adres `localhost` dotyczy komputera, na którym działa przeglądarka. Serwer uruchomiony w środowisku chmurowym nie jest dostępny przez `localhost` na Twoim komputerze.

## Uruchomienie dla programisty

Node.js 22+:

```sh
npm ci
npm run dev -- --port 5173
```

Uruchom te komendy w folderze projektu na swoim komputerze i otwórz adres podany przez Vite. Ścieżka `/workspace/WDSJ` dotyczy wyłącznie środowiska chmurowego.

Odtworzenie pojedynczego pliku HTML:

```sh
npm run build:standalone
```

Rozpocznij najazd lub wybierz pokaz techniki. W ostatnich 8 m przytrzymaj oba przyciski myszy i przesuń mysz w górę (około 120 px daje pełny cel wyprostu). Kierunek boczny przesuwa modelowaną linię reakcji, szybkość gestu zwiększa mimośród siły. R resetuje, spacja zatrzymuje symulację. Kamera boczna służy analizie ruchu.

## Kontrola jakości

```sh
npm run build
npm test
npm run build:standalone
npm run test:visual
```

Test używa systemowego /usr/bin/chromium (lub CHROMIUM_PATH). Obejmuje także zawartość pojedynczego HTML z wyłączonym dostępem do sieci. Polityka Chromium w chmurze blokuje nawigację `file://`, więc test osadza dokładną zawartość pliku na pustej stronie; otwarcie pliku na komputerze użytkownika wymaga przeglądarki dopuszczającej lokalne HTML.

Zrzuty kolejnych faz trafiają do artifacts/. Test przeglądarkowy sprawdza błędy konsoli, przejście najazd–lot i długości kości. To test dymny z zapisem obrazów, nie automatyczne porównanie z zatwierdzonym wzorcem.

## Zakres i ograniczenia

Pierwsza iteracja koncentruje się na proporcjach, stałych długościach segmentów, płynnym wyproście i fragmencie skoczni. Wymiary: udo 44 cm, podudzie 43 cm, tułów 53 cm, narty około 2.6 m. Profil jest projektowym przybliżeniem, nie certyfikowaną skocznią FIS.

Fizyka jest deterministyczna dla identycznych próbek na identycznych krokach. Wejście na żywo trafia do najbliższego kroku, bez pełnego systemu replayu. Przerwy klatek powyżej 250 ms są ograniczane. Rendering nie interpoluje stanu między krokami.

Wyprost jest ograniczonym napędem sprężysto-tłumiącym, a impuls normalny i moment bazują na parametrycznym ruchu środka masy. To nie pełna dynamika wieloczłonowa; brak ograniczeń siły mięśni i zmiennego momentu bezwładności. Wyprost nie oznacza niezależnie wyliczonej siły reakcji zeskoku. Duży gest zmienia moment, bez zaprogramowanego salta.

Lot to model 2D sił z prostym bocznym balansem; wiatr jest parametrem modelu, bez UI. Współczynniki aerodynamiczne nie zostały skalibrowane eksperymentalnie. V jest animowany; nie ma niezależnej dynamiki nart. Kontakt i upadek to tymczasowa klasyfikacja i końcowa poza, bez telemarku, amortyzacji i ragdolla. Pełne lądowanie należy do następnej iteracji.

Analiza poprzedniej wersji: [docs/REVIEW-v03.md](docs/REVIEW-v03.md).

## Zmiany wizualne 0.5

- Pełna panorama najazdu, progu, zakrzywionego zeskoku i płaskiego wybiegu. Kamera „Transmisja” śledzi zawodnika z boku i pokazuje teren przed nim; „Zawodnik” służy analizie pozy.
- Nowa sylwetka z modelowanym kombinezonem, twarzą, kaskiem/goglami, rękawicami, butami i profilowanymi nartami. Geometria pozostaje stała; ruch przebiega przez hierarchię stawów.
- Konstrukcja skoczni, schody, startowy pawilon, odległości, barierki, trybuny, las i łagodne górskie grzbiety. Elementy powtarzalne są renderowane instancjami.
- Kompaktowy HUD pozostawia środek ekranu grze. Widok pionowy ma osobny kadr i zasięg mgły.
- Zeskok ma ciągłą wysokość i styczną; fizyka kontaktu używa tej samej stycznej co geometria. To profil projektowy, bez certyfikacji FIS.

Referencja `skijumping.io` była niedostępna przez politykę sieci środowiska (CONNECT 403). Nie wykonano bezpośredniego porównania z jej grafiką. Sterowanie gestem obu przycisków, moment wybicia i stały krok 120 Hz zostały zachowane.

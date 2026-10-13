# SKYLIFT 3D — 0.7 / iteracja 04

Laboratorium najazdu i wybicia. Three.js + TypeScript + Vite; bez tekstur obrazkowych.

## Podgląd online: GitHub Pages

Workflow `.github/workflows/pages.yml` publikuje grę po każdym pushu do `main`, po instalacji z lockfile, testach fizyki i buildzie. Docelowy adres to `https://damwach.github.io/WDSJ/` (działa po udanym wdrożeniu).

Jednorazowe ustawienie repozytorium w GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Jeśli pierwszy workflow zakończył się przed włączeniem Pages, otwórz **Actions → Publish SKYLIFT to GitHub Pages → Run workflow**, wybierając gałąź `main`.

`npm run build:pages` ustawia ścieżki zasobów na `/WDSJ/`. Zwykłe `npm run build` pozostaje dostępne do hostingu w katalogu głównym, np. Vercel (Build command: `npm run build`, Output directory: `dist`). Vercel wymaga osobnego podłączenia repozytorium do projektu.

Do pracy lokalnej: sklonuj repozytorium, wejdź do jego folderu, uruchom `npm ci` i `npm run dev`. Lokalny Codex może edytować i uruchamiać tę samą wersję. Przed wysłaniem zmian wykonaj build oraz odpowiednie testy.

## Uruchomienie bez instalacji

Podgląd online działa pod adresem https://damwach.github.io/WDSJ/?v=0.7. Wybierz „Pokaz techniki” i kamerę „Zawodnik”, aby obejrzeć ruch z bliska.

Opcjonalnie pobierz `artifacts/SKYLIFT-0.7.html` na swój komputer i otwórz go w Chrome lub Edge. Plik zawiera cały kod, Three.js i style. Działa bez serwera, internetu i Node.js.

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

Zrzuty kolejnych faz trafiają do artifacts/. Test przeglądarkowy sprawdza błędy konsoli, najazd–lot–lądowanie, długości kości, kadr oraz interpolację. Zapisuje też izolowane pozy zawodnika. To kontrola działania z zapisem obrazów, nie automatyczne porównanie z zatwierdzonym wzorcem. Testy Chromium są wykonywane kolejno ze względu na współdzielone zasoby programowego WebGL w chmurze.

## Zakres i ograniczenia

Pierwsza iteracja koncentruje się na proporcjach, stałych długościach segmentów, płynnym wyproście i fragmencie skoczni. Wymiary: udo 44 cm, podudzie 43 cm, tułów 53 cm, narty około 2.6 m. Profil jest projektowym przybliżeniem, nie certyfikowaną skocznią FIS.

Fizyka jest deterministyczna dla identycznych próbek na identycznych krokach. Wejście na żywo trafia do najbliższego kroku, bez pełnego systemu replayu. Przerwy klatek powyżej 250 ms są ograniczane. Rendering interpoluje prezentację między krokami 120 Hz, bez zmieniania stanu fizycznego.

Model sił używa pełnej grawitacji, prędkości względem wiatru oraz osobnych powierzchni aerodynamicznych ciała i nart. Napęd wyprostu ma ograniczone siły; moment wybicia wynika z mimośrodu reakcji. Lądowanie wynika z kontaktu nart z profilem i rozprasza normalną energię; po nim następuje wybieg. W locie ruch myszy w pionie zmienia sylwetkę, w bok balans; wiatr ustawisz pod przyciskiem „?”.

Współczynniki aerodynamiczne, bezwładność i parametry mięśni są oszacowaniami. Nie wykonano walidacji tunelowej ani motion capture. Opis równań, naprawionego błędu grawitacji i ograniczeń: [docs/PHYSICS.md](docs/PHYSICS.md).

Analiza poprzedniej wersji: [docs/REVIEW-v03.md](docs/REVIEW-v03.md).

## Zmiany wizualne 0.5

- Pełna panorama najazdu, progu, zakrzywionego zeskoku i płaskiego wybiegu. Kamera „Transmisja” śledzi zawodnika z boku i pokazuje teren przed nim; „Zawodnik” służy analizie pozy.
- Nowa sylwetka z modelowanym kombinezonem, twarzą, kaskiem/goglami, rękawicami, butami i profilowanymi nartami. Geometria pozostaje stała; ruch przebiega przez hierarchię stawów.
- Konstrukcja skoczni, schody, startowy pawilon, odległości, barierki, trybuny, las i łagodne górskie grzbiety. Elementy powtarzalne są renderowane instancjami.
- Kompaktowy HUD pozostawia środek ekranu grze. Widok pionowy ma osobny kadr i zasięg mgły.
- Zeskok ma ciągłą wysokość i styczną; fizyka kontaktu używa tej samej stycznej co geometria. To profil projektowy, bez certyfikacji FIS.

Referencja `skijumping.io` była niedostępna przez politykę sieci środowiska (CONNECT 403). Nie wykonano bezpośredniego porównania z jej grafiką. Sterowanie gestem obu przycisków, moment wybicia i stały krok 120 Hz zostały zachowane.

## Zmiany 0.6

Naprawa grawitacji dzielonej przez masę, fizyczny COM i napęd kontaktu, poprawiona szybkość gestu, ograniczone ramię reakcji, oddzielne powierzchnie ciała/nart i trójwymiarowy kierunek nośności, moment i tłumienie aerodynamiczne, przygotowanie do kontaktu/lądowanie/wybieg oraz bardziej anatomiczny kask, gogle i pozycja zawodnika. Próbny pokaz w spokojnym powietrzu: około 69 m, 3.3 s lotu, kontakt około 2.2 m/s. To wynik modelu, nie porównanie z pomiarem rzeczywistego skoku.

## Zmiany 0.7

- Pełniejszy model z gładkimi profilami kombinezonu, granatowymi nogawkami, anatomiczną twarzą, dopasowanym kaskiem, wąskimi goglami, rękawicami i geometrycznym numerem startowym. Elastyczne powierzchnie kolan i łokci zginają się wraz ze stawami. Brak tekstur obrazkowych.
- Wspólna definicja pozy dla szkieletu i obliczeń środka masy. Kolana zaczynają wyprost przed biodrami; tułów pozostaje pochylony przy wybiciu. Przeniesienie ciała do pozycji lotnej poprzedza otwarcie nart do V.
- Przygotowanie do kontaktu, ograniczony zasięgiem nóg rozkrok telemarkowy, ugięcie po kontakcie i spokojniejsze odzyskanie pozycji. Amortyzacja jest warstwą wizualną, nie zwalidowanym modelem podatności mięśni.
- Bliższa kamera zawodnika oraz śledzenie przesunięcia, które usuwa opóźnienie kadru przy dużej prędkości. Interpolacja klatek wygładza ruch pomiędzy krokami fizyki.
- Załączoną v0.3 uruchomiono w Chromium i porównano sylwetkę oraz sekwencję wyprostu. Zachowano jej czytelność ruchu, bez kopiowania zmieniających się długości kości.

Szczegóły porównania i ograniczeń animacji: [docs/ATHLETE-v07.md](docs/ATHLETE-v07.md).

# Walidacja iteracji 01

Wykonano w środowisku chmurowym, 2026-10-13:

- npm run build: TypeScript i bundling Vite zakończone poprawnie. Ostrzeżenie: pakiet JS około 515 kB przed gzip (134 kB po gzip), głównie Three.js.
- npm test: 5/5 testów fizyki.
- npm run test:visual: 2/2 testy w systemowym Chromium, rendering WebGL przez SwiftShader. Brak błędów JS i console.error w sekwencji najazdu/wybicia/lotu.
- Cztery zrzuty w artifacts/: gotowość, najazd, wyprost i przejście do V. Obrazy obejrzano; poprawiono orientację normalnych najazdu, teren pod drzewami i czytelność panelu.
- Sprawdzono wejście przez zdarzenia pointermove: jeden przycisk nie wywołuje wyprostu, oba przyciski zmieniają cel wyprostu i boczny mimośród.
- Uruchomiono serwer Vite na porcie 5173.

Nie wykonano: walidacji biomechaniki na motion capture, pomiarów sił, porównania Cl/Cd z tunelem aerodynamicznym, testów sprzętowych GPU, automatycznego porównania pikseli, pełnych testów lądowania. Opis modelu i ograniczeń w README.md.

## Dystrybucja do uruchomienia na komputerze użytkownika

- `npm run build:standalone`: zakończone poprawnie; HTML zawiera skrypt aplikacji, Three.js i CSS.
- Test `standalone HTML renders and responds without a server or Internet`: 1/1 zakończony poprawnie. Chromium renderuje geometrię i reaguje na przyciski przy wyłączonej sieci, bez żądań HTTP i bez błędów konsoli. Zrzut: `artifacts/05-standalone.png`.
- Zarządzana polityka Chromium w chmurze blokuje `file://` (`ERR_BLOCKED_BY_ADMINISTRATOR`); test wczytuje dokładną zawartość pliku przez `page.setContent`. Nie potwierdzono bezpośredniego otwarcia lokalnego pliku w tym zarządzanym Chromium ani na komputerze użytkownika.
- `artifacts/SKYLIFT-0.4.zip` zawiera HTML i krótką instrukcję. Zweryfikowano zgodność zawartości HTML w ZIP z przetestowanym plikiem.

## Iteracja wizualna 0.5

- Build TypeScript/Vite i pakiet samodzielnego HTML.
- 10 testów jednostkowych: deterministyczny ruch, sterowanie, moment agresywnego wybicia, stałe długości nóg i kontakt nart, zakresy wysokości sylwetki, symetryczne V, brak przebudowy modelu przy zmianie pozy, ciągłość i pochodna profilu zeskoku.
- 4 testy Chromium: panorama z punktami startu/progu/zeskoku/wybiegu w kadrze, przejście przez wszystkie kamery i fazy ruchu, widok 390×844, gest obu przycisków, samodzielny dokument offline. Zrzuty zapisane w artifacts/; kontrole błędów konsoli włączone.
- Referencja skijumping.io nie mogła zostać otwarta z powodu blokady sieci. Nie deklarujemy zgodności graficznej potwierdzonej porównaniem z referencją.
- Aerodynamika i napęd wyprostu pozostają eksperymentalne; pełne lądowanie, ragdoll i kalibracja naukowa pozostają poza zakresem tej iteracji.

## Iteracja fizyczna 0.6

- Odtworzono nieskończony lot 0.5: po 60 s pokaz pozostawał w locie na x≈548 m, y≈142 m. Powód: grawitacja była podzielona przez masę.
- 38 testów jednostkowych przeszło: poprawna grawitacja / brak zależności spadku od masy, energia i kierunki sił, momenty w próżni, wiatr, skończony kontakt, szybkość/tempo próbkowania gestu, granice siły i ramienia, anatomia oraz profil skoczni.
- Pięć testów podstawowej ścieżki Chromium przeszło po końcowym buildzie: wszystkie kamery, najazd/wybicie/lot, panorama w telefonie, oba przyciski, lądowanie i wybieg, dokument offline. Zrzuty artifacts/01..07 oraz podgląd zawodnika obejrzano. Brak błędów konsoli w sprawdzanych przebiegach.
- Typowy pokaz: 69.45 m, 3.275 s lotu, kontakt 2.16 m/s. Ten sam gest120px w0.18s daje większy impuls niż w0.6s; przykład przyx−5.5m: szybki~69m, wolny~56m. Agresywny200px/0.07s kończy się wcześniejszym upadkiem po destabilizacji momentem.
- Build TypeScript/Vite i samodzielne HTML przechodzą. Nie ma sztucznego timera kończącego lot; wysokościowy test pozostaje w locie dopóki nie dotknie podłoża.
- Równania, założenia oraz brak kalibracji eksperymentalnej opisano w PHYSICS.md. Kontakt punktowy i upadek pozostają uproszczone; parametrów nie należy traktować jako zwalidowanych naukowo.
- Dodatkowy test Chromium z natywnym ruchem myszy oraz naciśnięciem lewego i prawego przycisku przeszedł. Sprawdza rzeczywiste zdarzenia, wyprost napędu i brak dalszego sterowania nogami po puszczeniu przycisków. Łącznie zweryfikowano 6 scenariuszy przeglądarkowych.

## Model i animacja 0.7

- Uruchomiono i obejrzano załączoną v0.3 w Chromium przez lokalny HTTP. Porównano najazd, wyprost i lot, zachowując stałe długości segmentów nowego szkieletu.
- 43/43 testy jednostkowe przeszły. Nowe kontrole obejmują monotoniczną wysokość COM/inwersję napędu, kolejność pracy kolan i bioder, opóźnione otwarcie V, ciągłość przejść oraz amortyzację i odzyskanie pozycji bez rozciągania nóg.
- 9/9 testów Chromium przeszło: wszystkie dotychczasowe scenariusze oraz pełna sekwencja w zbliżeniu, niezależność interpolacji od fizyki i izolowane pozy modelu. Zapisano i obejrzano kadry 01–14 i cztery izolowane pozy. W sprawdzanych przebiegach brak błędów konsoli.
- Przy dwóch równoległych instancjach programowego WebGL dwa testy przekroczyły limit 30 s, podczas robienia zrzutów i oczekiwania na klatkę. Końcowe uruchomienie jest sekwencyjne (jeden worker) z limitem 60 s; wszystkie scenariusze przeszły, najdłuższy 19 s. Nie wyłączono kontroli błędów ani asercji.
- Przykładowy pokaz w spokojnym powietrzu: lądowanie 64.39 m, lot 3.075 s, normalna prędkość kontaktu 2.776 m/s. Liczby opisują tę wersję modelu, nie rzeczywisty pomiar skoczka.
- TypeScript/Vite i samodzielny HTML 0.7 przechodzą; dokument offline nie żąda zewnętrznych zasobów. Ruch przez oba fizycznie naciśnięte przyciski myszy nadal steruje napędem wybicia.
- Deformowane powierzchnie stawów zweryfikowano dla 137214 wierzchołków w zakresie −2.3..0.15 rad: skończone pozycje i normalne jednostkowe. Bufory są ponownie używane.
- Parametry ruchu są procedurami animacyjnymi; amortyzacja po kontakcie i upadek pozostają uproszczone. Nie wykonano kalibracji na motion capture ani pomiarach reakcji podłoża. Szczegóły: ATHLETE-v07.md i PHYSICS.md.

## Wymiary z certyfikatu HS140 / 0.8

- Źródłowy PDF obejrzano i odczytano; zachowano w `docs/reference/HS140_2022.pdf`. Poprawny zapis nachylenia wybiegu to 17°, mimo błędnego OCR „47°”. JSON profilu zawiera SHA-256 źródła.
- 52/52 testy jednostkowe przeszły. Dziewięć kontroli geometrii obejmuje długości 97.80/77.00/6.50m, kąt 35°/11°, R90, K=(107.76,−62.37)m, wysokość progu 3.13m, U=−89.11m, promienie i kąty przy P/K/L/U, łuki 16/15m, wznios 17°, szerokości i linie P109/K125/HS140. Test deterministyczności obejmuje teraz 12s, czyli cały skok i początek wybiegu przy 30/144Hz.
- 10/10 scenariuszy Chromium przeszło. Nowy test porównuje wierzchołki renderowanego najazdu/zeskoku z wysokością kolizji, szerokość toru 2.65m/K25m, położenie wieży d84m/q35m i nazwę obiektu. Panorama mieści A/T/K/L/U/koniec wybiegu także w 390×844. Brak błędów konsoli w sprawdzanych przebiegach.
- Obejrzano zrzuty 01–15 oraz wykres metryczny SVG/PNG. Kamera zawodnika została dostosowana do węższego toru. Budynki, góry i teren poza profilem pozostają proceduralne.
- Typowy pokaz w bezwietrznych warunkach modelu: prędkość przy progu około 26.99m/s, lądowanie 123.26m, lot 4.008s, normalna prędkość kontaktu 5.23m/s. Wynik nie jest pomiarem rzeczywistego zawodnika ani walidacją v0 z certyfikatu. Test potwierdza styczny kierunek prędkości po rozproszeniu normalnej energii i zatrzymanie przed końcem wybiegu.
- Powierzchnia ciała została zmierzona z rzutu siatki: 0.488704/0.489008/0.489100m² przy kroku 4/2/1mm. Do sił przyjęto 0.489m², małe wydłużenie powierzchni i zmienione oszacowania trymu/tłumienia. Bez kalibracji eksperymentalnej; PHYSICS.md opisuje założenia.
- Build TypeScript/Vite/Pages i samodzielny HTML 0.8 przechodzą. Dokument offline działa bez żądań HTTP. Gest obu przycisków nadal napędza wybicie.
- Podane wielkości nie wyznaczają unikalnej krzywej: brak βS/b2, niespójne h/n, rozstaw belek i rL/l1/l2. Przyjęte interpolacje i priorytety danych są jawne w HILL-HS140.md; nie deklarujemy dokładnej reprodukcji pomiaru ani certyfikacji modelu gry.

## 0.9 — przegląd PR #1 / tunel

Naprawiono zaokrąglenie gęstości domyślnej 1.225 → 1.23, przepływ znaczników przy zerowej prędkości, dublowanie pętli po szybkim ponownym otwarciu, niepoprawne wartości API, brak skali wykresu i ukrywanie nart przez podłogę. CSV zawiera komplet warunków, porównanie A/B zachowuje pozycje, L/D bez oporu jest oznaczane jako nieokreślone. Podgląd, szkielet i współdzielony moduł aerodynamiki są zgodne na końcach zakresów suwaków.

Testy Chromium porównują widoczne kąty tułowia i obu nart z parametrami obliczeń, sprawdzają cały model w kadrze i nad podłogą, zerowy przepływ, pojedynczą pętlę RAF, niezmieniony stan przerwanego skoku, eksport CSV oraz ekran 390×844. Zrzuty: `tunnel-desktop.png`, `tunnel-mobile.png`, `tunnel-mobile-controls.png`. Geometria HS140 i współczynniki sił pozostają jak w 0.8.

CI Deno zastąpiono kontrolą Node/TypeScript/Vitest/Playwright, po odtworzeniu 63 diagnostyk lintera na jego historycznym commicie. Rzeczywiste dwa zbędne importy usunięto. Dokładny opis i wyniki dostępności źródeł: [CI.md](CI.md), [AERODYNAMIC-AUDIT.md](AERODYNAMIC-AUDIT.md).

Wynik lokalny: build TypeScript/standalone poprawny, **61/61 testów jednostkowych i 14/14 testów Chromium/WebGL**. Testy tunelu nie wykryły błędów strony ani konsoli. Sprawdzono zrzuty desktop i telefon. To weryfikacja programu, nie walidacja aerodynamiczna.

# Powtarzalne porównania sterowania i fizyki

[`src/physics/scenarios.ts`](../src/physics/scenarios.ts) uruchamia osiem skoków z ustalonymi wejściami. Każdy zaczyna na belce 34 Wielkiej Krokwi z postoju, przy masie 78 kg, gęstości `1.225 kg/m³`, grawitacji `9.80665 m/s²` i zerowym wietrze. Narty, szkielet, charakterystyki aerodynamiczne, próg i zeskok są identyczne. Różnią się wyłącznie opisane polecenia gracza oraz jawne zaburzenie wiatru.

To porównanie **obecnego niezwalidowanego modelu**, nie zbiór rzeczywistych skoków. Referencyjnego gestu nie nazwano optimum: 500 px/s i początek przy `x=−6.5 m` odpowiadają dotychczasowemu pokazowi techniki. W tym porównaniu gest dodatkowo ma limit długości 120 px. Żaden wynik nie jest poprawiany do 120–140 m.

## Scenariusze

| Identyfikator | Zmieniane wejście |
| --- | --- |
| `no-takeoff` | Brak gestu. Skoczek odrywa się na końcu progu. |
| `nominal` | Ruch w górę 500 px/s od `x=−6.5 m`, do 120 px lub utraty kontaktu. |
| `early` | Taki sam ruch od `x=−8 m`. |
| `late` | Taki sam ruch od `x=−1 m`; czas pozostałego kontaktu ogranicza faktyczną długość. |
| `excessive` | 1200 px/s od `x=−6.5 m`, do 180 px. Ruch boczny pozostaje zerowy. Obrót wynika z momentu reakcji podłoża. |
| `changing-wind` | Gest referencyjny; wiatr X zmienia się na −2 m/s po 0.75 s lotu, następnie na +2 m/s po 1.75 s lotu. Wiatr poprzeczny pozostaje zerowy. |
| `upright-flight` | Gest referencyjny; od 0.6 s lotu wejście myszy 1000 px/s zmierza do pochylenia tułowia 1.05 rad od lokalnego pionu. |
| `flat-flight` | Analogiczne wejście lotne zmierza do 1.42 rad. |

Gest podawany jest przed każdym krokiem 1/120 s, w CSS px oraz sekundach, przez publiczne `gesture()` / `trim()`. Po zakończeniu ruchu nie dopisywane są sztuczne impulsy. Polecenia pozy lotnej stopniowo dochodzą do celu przez ruch myszy; nie nadpisują stanu ciała. Ostatnia niepełna próbka wybicia zachowuje zadaną prędkość ruchu poprzez odpowiednią długość i czas zdarzenia.

Prędkość ruchu lotnego w scenariuszu jest ustalonym wejściem porównawczym. Nie oznacza zwalidowanej szybkości mięśni ani rozwiązania bezwładności stawów: obecne API `trim()` nadal bezpośrednio zmienia cel pochylenia.

## Odtwarzanie i eksport

Uruchomienie:

```sh
node scripts/export-scenarios.mjs
```

Powstają [`artifacts/scenario-summary.json`](../artifacts/scenario-summary.json) oraz [CSV](../artifacts/scenario-summary.csv). JSON zachowuje konfigurację, definicję scenariusza, rzeczywisty harmonogram wejść z numerami kroku, metryki, stan końcowy i SHA-256 źródeł fizyki/geometrii. Nie zawiera ośmiu dużych zapisów wszystkich klatek 120 Hz. Pełny zapis skoku w formacie importowanym przez Physics Debugger zapewnia osobny `JumpRecorder`; ten plik jest raportem porównawczym, nie jego zamiennikiem.

`replayScenario(run)` podaje zarejestrowane polecenia w tych samych krokach bez ponownego wykonywania warunków wyzwalających. Eksporter sprawdza ścisłą zgodność stanu końcowego i metryk wszystkich ośmiu powtórzeń. Dotyczy to tego samego kodu i silnika JavaScript; nie jest obietnicą bitowej zgodności między dowolnymi platformami ani walidacją fizyki.

Metryki kończą się na pierwszym kontakcie z podłożem. `phase` oznacza decyzję obecnego modelu `landed`/`fallen`; `elapsedSeconds` to czas końca kroku wykrywającego kontakt, z rozdzielczością 1/120 s. Prędkość kontaktu jest składową normalną do lokalnego profilu. `positiveActuatorWorkJ` jest wskaźnikiem pracy zastępczego napędu pryzmatycznego, nie pomiarem energii mięśni. Maksymalna reakcja i prędkość kątowa pochylenia obejmują najazd, wybicie i lot do kontaktu.

Limit diagnostyczny wynosi 16 s. Przekroczenie limitu zwraca `timeout` z rzeczywistą fazą; nie wymusza lądowania i nie zmienia trajektorii. Eksporter odrzuca taki nieukończony zestaw.

## Wyniki tej iteracji

Liczby poniżej są wynikami obliczeń źródeł wskazanych w raporcie SHA-256, bez kalibracji na pomiarach:

| Scenariusz | Dystans [m] | Kontakt | Prędkość normalna [m/s] | Impuls wybicia [N·s] | Maks. `|omega|` [rad/s] |
| --- | ---: | --- | ---: | ---: | ---: |
| Bez wybicia | 18.69 | Lądowanie | 4.17 | ≈0 | 0.125 |
| Referencyjny | 123.28 | Lądowanie | 5.23 | 105.33 | 0.328 |
| Wczesny | 123.47 | Lądowanie | 5.31 | 100.02 | 0.338 |
| Spóźniony | 18.95 | Lądowanie | 4.08 | 4.61 | 0.124 |
| Przesadzony | 20.70 | Upadek | 6.58 | 219.26 | 1.682 |
| Zmienny wiatr | 124.23 | Lądowanie | 5.78 | 105.33 | 0.309 |
| Bardziej pionowy tułów | 167.87 | Upadek | 11.20 | 105.33 | 0.231 |
| Bardziej płaski tułów | 101.35 | Lądowanie | 3.29 | 105.33 | 0.370 |

Wybrane wejście referencyjne wyraźnie poprawia skok wobec braku gestu. Bardzo późne wybicie nie zdąża wytworzyć podobnego impulsu. Przesadzone wybicie daje większy impuls, ale znacznie większą prędkość obrotową i upadek bez zaprogramowanej animacji salta. Próby lotnego pochylenia i wiatru mają dokładnie takie samo wybicie, co pozwala oddzielić ich skutki od gestu na progu.

**Wczesny gest nie jest tutaj karany krótszym dystansem:** daje około 0.19 m więcej niż wybrane wejście referencyjne, przy większej prędkości normalnej lądowania i mniejszym impulsie. Ten zestaw nie potwierdza zatem tezy, że każde wcześniejsze wybicie musi pogarszać wynik. Jest to jawne ograniczenie obecnego porównania/modelu. Nie wprowadzono funkcji kary ani korekty współczynników, żeby wymusić oczekiwaną kolejność.

Duży dystans przy bardziej pionowym tułowiu kończy się upadkiem i nie świadczy o poprawnej technice. Pokazuje, dlaczego sam dystans lub maksimum L/D nie są wystarczającą oceną. Aerodynamika pozy oraz kryterium absorpcji lądowania wymagają niezależnych danych; szczegóły zawiera [audyt](AERODYNAMIC-AUDIT.md).

Bez gestu obliczenie pozostawia około `2.3e−15 N·s` impulsu i `7.4e−14 J` dodatniej pracy wskutek błędu zmiennoprzecinkowego. Surowe wartości pozostają w raporcie; test zerowego napędu używa tolerancji `1e−9` w odpowiedniej jednostce i nie zaokrągla fizyki w celu ukrycia różnic.

## Kontrole automatyczne i dalsza ocena

[`tests/scenarios.test.ts`](../tests/scenarios.test.ts) sprawdza identyczne warunki początkowe, skończony kontakt, ograniczenie reakcji do 3.4 ciężaru, zerowy napęd bez wejścia, skutki czasu gestu, destabilizację bez ruchu bocznego, oddzielenie wpływu pozy/wiatru od wybicia, dokładne odtworzenie ośmiu harmonogramów oraz brak sztucznego kontaktu przy wyczerpaniu budżetu.

Nie wykonano dziesięciu prób z graczami ani porównania trzech trajektorii z obserwacjami terenowymi. Następny etap powinien poszerzyć mapę czasu i szybkości wybicia, pozyskać polary wraz z momentami oraz porównać serię powtarzalnych prób użytkowników. Dystans pozostaje raportowaną konsekwencją modelu, a nie celem strojenia współczynników.

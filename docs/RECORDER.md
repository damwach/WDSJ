# Rejestrator skoków i deterministyczny replay

Rejestrator zapisuje jeden niezmienny rekord po każdym wykonanym kroku symulacji `DT = 1/120 s`. Nie próbuje mierzyć czasu zegarowego przeglądarki. Pauza zatrzymuje czas fizyki; interpolacja renderowania nie dopisuje próbek ani nie zmienia symulacji. Kod znajduje się w `src/physics/recorder.ts`, diagnostyka solvera w `src/physics/simulation.ts`.

Ta iteracja dodaje obserwowalność i odtwarzanie. Nie zmienia współczynników aerodynamicznych, integratora, sił, wymiarów skoczni ani parametrów wybicia. Przed i po dodaniu telemetrii porównano 243 000 wartości skalarnych w 5400 krokach trzech scenariuszy z gestami, zmianą pozycji i wiatrem: wartości pozostały identyczne bitowo.

## Format JSON, schemat 1

Obiekt zawiera `header`, `initialState` i `frames`. Nagłówek zapisuje:

- wersję schematu i modelu fizyki, SHA-256 źródeł solvera, aerodynamiki, biomechaniki, pozy, sterowania i skoczni;
- osobny SHA-256 źródeł rekonstrukcji skoczni, identyfikator commitu/builda i czas UTC rozpoczęcia;
- masę, gęstość powietrza, przyspieszenie grawitacyjne, belkę startową i początkowy wektor wiatru;
- tryb pokazu, krok 1/120 s, częstotliwość 120 Hz, `seed: 0` i `randomness: "none"` — obecny solver nie używa generatora losowego;
- jednostki SI; gesty pozostają w pikselach CSS, pikselach CSS/s i sekundach.

Każda próbka ma całkowity numer `tick` od 1 i czas po kroku. `initialState` odpowiada krokowi 0 po normalnym resecie. JSON zachowuje pełną precyzję liczb JavaScript; nie zaokrągla wartości fizycznych dla potrzeb wyświetlania. Znak zera może zostać ujednolicony przy serializacji JSON, co nie zmienia różnicy numerycznej.

`state` jest kopią publicznego stanu solvera, a `com` zawiera pozycję i prędkość środka masy. Pola `state.vx/vy/vz` są surowymi polami integratora lotu: w najazdzie i na wybiegu nie są aktualizowane przez obecny model kontaktu. Dlatego `com.velocity` ma jawne pochodzenie:

- `finite-difference-contact`: różnica rzeczywistych pozycji COM między krokami, podzielona przez `DT`, w kontakcie ze skocznią;
- `integrated-flight`: prędkość używana przez integrator lotu, także w próbce odłączenia od progu;
- `post-impact-constraint`: prędkość po impulsie zderzenia, styczna do lokalnego profilu zeskoku.

`orientation` zapisuje pitch i roll w radianach. `angularVelocity` zapisuje odpowiadające im szybkości kątów Eulera. Yaw, szybkość yaw i moment yaw mają wartość `null`: nie są obsługiwane przez ten model. Nie jest to pełna dynamika sześciu stopni swobody ani pełny wektor prędkości kątowej sztywnej bryły.

`pose` zawiera tę samą pozę hierarchicznego modelu co renderer: kąty segmentów obu nóg, tułowia, ramion, łokci, głowy i nart oraz współczynnik otwarcia V. Kąty `legs[].upper/lower` są orientacjami segmentów w lokalnej płaszczyźnie; zgięcie kolana to `upper-lower`. Otwarcie pojedynczej narty wynosi `±0.25 * pose.v` rad. Nie należy interpretować kąta segmentu jako dowolnie nazwanego kąta anatomicznego.

`wind.vector` ma składowe w m/s, `speed` jest normą, a `directionRadians` azymutem od +X w stronę +Z. Kierunek zerowego wiatru jest `null`; wiatr pionowy pozostaje nieobsługiwany.

## Czas sił i kontaktu

Próbka po kroku i siły użyte do tego kroku opisują różne chwile. `evaluation.timeStart/timeEnd` wyznaczają przedział integracji. `evaluation.aero.state` zachowuje dokładną prędkość, orientację, wiatr i pozę przekazaną do wspólnego `aerodynamicForces()`. `aero.time` oznacza chwilę prędkości/orientacji przed integracją, a `poseSampleTime` chwilę próbkowania pozy. Obecny solver aktualizuje przejście pozy przed oceną sił; rejestrator jawnie zachowuje ten porządek.

`forces` udostępnia wektory nośnej, oporu, sumy aerodynamicznej, grawitacji i reakcji kontaktu oraz moment pitch/roll. W locie `net` jest sumą aerodynamiki i grawitacji. W najazdzie sumuje grawitację, reakcję, opór i tarcie modelu pryzmatycznego. Jest to diagnostyka sił uproszczonego solvera, a nie niezależny pomiar siły na każdej części ciała.

`evaluation.contact` zapisuje reakcję przed jej wyzerowaniem przy odłączeniu, surową żądaną siłę, krzywiznę toru, prędkość wyprostu, ramię i moment reakcji oraz pracę mięśni. `takeoff` zapisuje powód odłączenia, impuls normalny i prędkość COM. Impuls pochodzi z już obliczonej reakcji i ruchu nóg; rejestrator nie dodaje siły w locie.

`evaluation.landing` zapisuje lokalną normalną, położenie pierwszego przecięcia, udział kroku do kontaktu, prędkość przed zderzeniem i po impulsie, energię normalną, założoną zdolność absorpcji, błąd ustawienia i wynik kontaktu. Czas kontaktu jest interpolowany z przecięcia w obrębie kroku, ale prędkość przed kontaktem pochodzi z całego kroku Eulerowskiego. Obecny solver aktualizuje COM do pozycji kontaktu w kolejnym kroku modelu wybiegu; rekord zachowuje ten stan, zamiast maskować niespójność korektą trajektorii.

Solver wybiegu nie rozwiązuje siły normalnej ani pełnego impulsu ograniczeń. W tej fazie `forces.contact` i `forces.net` są `null`, a `evaluation.outrun.reactionResolved` jest `false`; opór i tarcie pozostają dostępne. Animacja absorpcji po lądowaniu jest wizualną odpowiedzią pozy, nie rozwiązaniem kontaktu wielu brył.

## Wejścia i replay

Wywołania `queueGesture`, `queueTrim` i `queueWind` trafiają do następnego kroku fizyki w kolejności zgłoszenia. Dziennik przechowuje również prawidłowe składniowo komendy zignorowane z powodu fazy skoku, zbyt wczesnego gestu lub niewłaściwego czasu gestu. Każda ma `accepted` i `reason`. Gesty automatycznego pokazu znajdują się osobno w `automaticInputs`; replay ponownie uruchamia logikę pokazu i **nie** dokłada ich jako gestów gracza.

```ts
const recorder = new JumpRecorder(new Simulation({ gate: 34 }));
recorder.start(false);
recorder.queueWind(-2, 0.5);
recorder.queueGesture({ up: 4, side: 0, duration: 1 / 120 });
recorder.step(); // wywoływane przez zegar stałego kroku
const json = recorder.exportJSON();
const recording = parseJumpRecording(json);
const replay = new JumpReplay(recording);
const report = replay.validate();
const previewSimulation = replay.seek(100); // dla zapisu z co najmniej 100 krokami
```

`JumpReplay` buduje nową symulację z nagłówka, odtwarza komendy i porównuje **każde pole każdej rekonstruowanej próbki**. Forward seek wykonuje tylko brakujące kroki; przewinięcie wstecz zaczyna od stanu początkowego. `validate()` wykonuje pełną rekonstrukcję i zwraca osobny przebieg `recomputedFrames`. Oglądanie replayu nie zmienia żywego skoku.

Tolerancja `REPLAY_TOLERANCE = 1e-9` jest absolutną różnicą każdego pola numerycznego w jego jednostce; pozostałe wartości i struktura muszą się zgadzać. To kryterium zgodności implementacji, **nie** dokładność naukowa w metrach czy niutonach. Testy w tym samym silniku JavaScript dają maksymalną różnicę 0. Nie zagwarantowano identyczności funkcji trygonometrycznych między wszystkimi silnikami i platformami.

Import odrzuca niezgodny schemat, krok, losowość, pionowy wiatr, źródła fizyki lub geometrię. Inny commit jest dozwolony, jeżeli SHA-256 źródeł fizyki i skoczni pozostają identyczne, np. po zmianie samych napisów interfejsu. Pełna rekonstrukcja odrzuca zmienione próbki lub dziennik z komunikatem wskazującym pole i krok. Format nie zawiera podpisu kryptograficznego: nie poświadcza autora ani autentyczności pliku.

## Granice pierwszej implementacji

- Rejestrator rozpoczyna skok normalnym `start()`/resetem. Nie importuje dowolnego stanu stworzonego przez `setAirborne()` ani ręczne modyfikowanie pól symulacji. Bezpośrednia zmiana stanu poza dziennikiem jest wykrywana przed krokiem; aplikacja może oznaczyć zapis jako nieważny i kontynuować podgląd.
- Eksport jest niezmienną migawką; późniejsze kroki nie dopisują do już pobranego pliku. `finish()` kończy ważny zapis; restart archiwizuje poprzedni ważny skok, także nieukończony.
- Historia przechowuje ostatnie 10 zapisów w pamięci karty. Odświeżenie strony ją usuwa. Trwałe zachowanie wymaga eksportu JSON. Nie zapisujemy dużych przebiegów automatycznie do localStorage.
- Import ma limity 64 MiB, 36 000 próbek, 1024 komend na krok, głębokości struktury i zakresów parametrów. Rejestrowanie ma limit 300 s czasu symulacji. Bardzo długie lub nietypowo gęste dzienniki mogą przekroczyć niezależny limit rozmiaru importu; zwykły skok mieści się znacznie poniżej obu limitów.
- Odtwarzanie i zgodność tunelu z lotem nie walidują CL, CD ani Cm. Obecne charakterystyki, dynamika obrotowa, masa segmentów, mięśnie i kontakt pozostają przybliżeniami opisanymi w `AERODYNAMIC-AUDIT.md` i `PHYSICS.md`.

`tests/recorder.test.ts` obejmuje 20 przypadków: pełny skok, wejścia ignorowane i ich kolejność, pokaz, własne parametry/belki/wiatr, siły w chwili oceny, reakcję przy odłączeniu, kontakt przed/po impulsie, przewijanie, 30/144 Hz, niezmienność i historię, bezpośrednią zmianę stanu oraz błędne/modyfikowane dane i niezgodne wersje.

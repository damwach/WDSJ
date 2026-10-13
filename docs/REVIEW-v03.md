# Analiza wersji 0.3

Źródło: dostarczony skylift_3d_v03.html. Analiza kodu, bez pomiarów aerodynamicznych.

- Rendering WebGL, budowa świata, wejście, UI i fizyka są zamknięte w jednym dokumencie i współdzielą mutable state. Utrudnia to testowanie oraz wymianę modelu sił.
- makeJumper interpoluje współrzędne stawów, zamiast obracać segmenty o stałej długości. To zmienia długości ud i podudzi. Buffer geometrii jest odtwarzany i przesyłany na GPU podczas animacji.
- mouseSpeed jest sumą przemieszczeń, a nie prędkością mierzoną względem czasu. Zależy od częstotliwości zdarzeń; sterowanie mutuje stan pomiędzy krokami fizyki.
- Jest już stały krok 1/120 s. Jednak ograniczenie czasu klatki do 48 ms traci czas przy długich klatkach, a zdarzenia wejściowe nie mają deterministycznego replayu.
- legImpulse jest całkowany z prędkości wyprostu, ale pozycja bazowa pozostaje przyklejona do najazdu. Ruch środka masy i bilans pędu kontaktu nie są wspólnie rozwiązywane. Po przejściu progu ustawiana jest stała wysokość .66.
- Moment wybicia ma arbitralne ramię zależne od overdrive. Nie wynika z rozkładu mas i stawowych sił. Ograniczenia omega maskują skrajne zachowania.
- Aerodynamika ma eksperymentalne Cl/Cd, stałą powierzchnię i bezwładność. Moment stabilizujący nie skaluje się z ciśnieniem dynamicznym. Brakuje danych walidacyjnych i aerodynamicznego sprzężenia nart z ciałem.
- Lądowanie jest progiem decyzyjnym i zatrzymaniem, bez amortyzacji, kolejności kontaktów oraz mechaniki upadku.

# Architektura 0.4 / iteracja 01

src/world/hill.ts: geometria w metrach, ciągłe nachylenie.
src/input/gesture.ts: kolejka próbek kierunku i czasu gestu.
src/physics/simulation.ts: czysta symulacja 120 Hz, kontakt, eksperymentalne siły i momenty.
src/athlete/rig.ts: stałe długości kości i lokalne stawy, tłumaczenie miednicy z kinematyki nóg.
src/render/scene.ts: materiały proceduralne, oświetlenie, cienie, kamery.
src/main.ts: koordynacja i UI.

Następny etap: timestampowane nagrania wejścia, interpolacja renderingu, model rozkładu mas, ograniczenia stawów i kontaktu, a następnie kalibracja sił na podstawie publikacji i pomiarów. Nie należy traktować bieżących współczynników jako zweryfikowanych naukowo.

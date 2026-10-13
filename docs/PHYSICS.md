# Model fizyczny 0.7

## Naprawiony błąd i odtworzenie

W 0.5 równanie pionowe miało postać `(-g + Fy) / m`. Dodanie przyspieszenia do siły i podzielenie całości przez masę dawało efektywną grawitację `9.81 / 78 ≈ 0.126 m/s²`. Odtworzony pokaz po 60 sekundach nadal leciał: około 548 m od progu i 142 m nad poziomem progu.

W 0.6 obowiązuje `ay = -g + Fy/m`, `g = 9.80665 m/s²`. Masa wpływa na odpowiedź na siły, nie na przyspieszenie swobodnego spadku. Nie ma limitu czasu maskującego lot — przejście na zeskok wynika z przecięcia powierzchni.

## Przepływ, siły i momenty

`src/physics/aerodynamics.ts` używa jednostek SI:

- prędkość powietrza względem zawodnika `u = v - wiatr`;
- ciśnienie dynamiczne `q = 0.5 rho |u|²`, `rho = 1.225 kg/m³`;
- nośność `L = q S Cl` i opór `D = q S Cd` liczone oddzielnie dla nart (2 × 2.6 × 0.115 m²) i ciała (referencyjne 0.70 m²);
- kąt natarcia z iloczynów skalarnych przepływu z cięciwą i normalną powierzchni, uwzględniających pochylenie i przechył;
- kierunek nośności jest projekcją normalnej powierzchni na płaszczyznę prostopadłą do przepływu; opór jest przeciwny do przepływu;
- ciągłe przejście od liniowego wzrostu Cl do przepływu oderwanego oraz nieujemny opór profilowy/indukowany;
- moment aerodynamiczny `M = q S c Cm`, z bezwymiarową prędkością kątową `omega c/(2|u|)` i tłumieniem skalującym się z ciśnieniem;
- pozycja fizycznego środka masy integrowana jest krokiem 1/120 s. Renderowany szkielet porusza się względem COM, więc zmiana pozy nie dodaje impulsu translacyjnego.

W spokojnym powietrzu siła nośna nie wykonuje pracy translacyjnej, a opór odbiera energię. W wietrze siły są liczone względem powietrza; energia zawodnika w układzie ziemi może pochodzić z wiatru. Zero prędkości względnej daje zero sił bez dzielenia przez zero. W próżni nie ma aerodynamicznego tłumienia przechyłu.

## Kontakt i wybicie

`src/physics/biomechanics.ts` odtwarza dwuwymiarową kinematykę stałych odcinków i przybliżonego rozkładu mas segmentów (70 kg ciało / 8 kg sprzęt przy domyślnej masie 78 kg). Masa i gęstość są konfigurowalne. Sterowana wysokość COM jest mapowana odwrotnie na wyprost nóg.

Od 0.7 kinematyka jest współdzielona w `src/athlete/pose.ts`, a nie powielona w renderingu i obliczeniach masy. Napęd kolan poprzedza biodra i tułów; wysokość COM nadal rośnie monotonicznie. Siły aerodynamiczne używają aktualnego pochylenia tułowia i otwarcia V podczas przejścia, zgodnych z widoczną pozą. Czas przejścia jest założeniem animacyjnym, nie pomiarem zawodnika.

Przy kontakcie normalna reakcja wynosi `N = m(g_n + v² kappa + h'')`. Napęd nóg steruje docelową prędkością i wysokością wyprostu, z ograniczeniem reakcji do 3.4 ciężaru ciała. Utrata reakcji lub osiągnięcie końca progu przenosi rzeczywistą prędkość COM do lotu. Impuls to `m delta_v_n`, praca napędu jest całkowana. Dalszy wyprost w powietrzu zmienia pozycję segmentów względem COM i nie dodaje siły zewnętrznej.

Próbki gestu zapisują przemieszczenie i rzeczywisty odstęp czasu. Sumowana długość / sumowany czas wyznaczają średnią szybkość; nie jest używana wyłącznie prędkość ostatniego zdarzenia ani minimum 8 ms. Długość gestu ustala cel wyprostu, szybkość ogranicza tempo napędu, położenie w najazdzie określa dostępny czas kontaktu, ruch boczny przesuwa linię reakcji. Zbyt szybki/długi ruch zwiększa mimośród w granicach geometrii ciała (ramię najwyżej 18 cm); `M = N r` generuje prędkość kątową. Nie ma zaprogramowanego salta ani nieograniczonego ramienia od ekstremalnej myszy.

## Lądowanie

Kontakt jest pierwszym przecięciem punktu odniesienia nart z profilem, interpolowanym wewnątrz kroku. Prędkość normalna jest liczona względem lokalnej stycznej. Normalna energia jest rozpraszana przez kontakt, a do wybiegu przechodzi wyłącznie prędkość styczna. Kryterium absorpcji używa szacunkowego budżetu `4 m g × 0.45 m`, oprócz ułożenia nart, przechyłu i prędkości kątowej. Wyprost do lądowania zaczyna się według szacowanego czasu kontaktu. Zeskok ma łagodniejszy odcinek pod progiem i stromy odcinek lądowania; renderowanie i kolizja współdzielą profil.

Po kontakcie ugięcie/recovery kolan jest warstwą prezentacji skalowaną prędkością uderzenia. Nie całkuje sił mięśni ani normalnego kontaktu i nie jest fizycznym modelem amortyzacji. Narty pozostają na wspólnej płaszczyźnie dzięki kinematyce odwrotnej. Telemark jest ograniczony zasięgiem nóg. Środek masy w locie pozostaje fizyczny; po kontakcie masa prezentowanej pozy może różnić się od zredukowanego modelu wybiegu.

## Walidacja i granice

Testy sprawdzają jednostki sił, skalowanie z prędkością² i gęstością, ortogonalność nośności, rozpraszanie przez opór, poprawną grawitację dla różnych mas, brak momentu w próżni, skończony kontakt w wietrze, normalny pokaz, odpowiedź na czas gestu i zachowanie parametrów podczas resetu.

To model zredukowany, nie pełna dynamika wieloczłonowa ani CFD. Współczynniki Cl/Cd/Cm, masy segmentów, stałe bezwładności (18 kg m² dla pochylenia, 14 kg m² dla przechyłu), ograniczenia napędu i absorpcji są jawnymi założeniami inżynierskimi. Nie skalibrowano ich na danych tunelu aerodynamicznego, sił reakcji ani motion capture. V ma przybliżony wpływ na nośność; brak niezależnej dynamiki każdej narty i modelu wzajemnego oddziaływania przepływu. Kontakt próbkowany jest przy wiązaniach, nie na całej długości nart. Upadek jest uproszczonym ślizgiem, bez ragdolla i symulacji obrażeń. Nie deklarujemy naukowo zwalidowanego realizmu.

# Audyt aerodynamiki i biomechaniki

Stan audytu: 13 października 2026, model fizyki 0.8 oraz PR [#1](https://github.com/damwach/WDSJ/pull/1). Punktem wyjścia jest commit `64498fee9577308656b978189cef7e9d6476c10d`. Audyt nie zmienia współczynników, profilu Wielkiej Krokwi ani trajektorii, żeby osiągnąć określony dystans.

Tunel jest interaktywnym stanowiskiem do badania **obliczeń tego samego modelu co lot**. Nie jest obliczeniem CFD ani pomiarem w fizycznym tunelu. Poprawne jednostki i deterministyczny replay umożliwiają weryfikację implementacji; nie zastępują walidacji wobec danych zawodnika.

## Co sprawdzono w kodzie

| Moduł | Ustalenie | Granica interpretacji |
| --- | --- | --- |
| [`aerodynamics.ts`](../src/physics/aerodynamics.ts) | `u = velocity − wind`, `q = ρ|u|²/2`, `F = q S C`; opór jest przeciwny do przepływu, nośność prostopadła do `u`. | Są to poprawne zależności wymiarowe. Wartości polarnych charakterystyk nie pochodzą z pomiarów skoczka. |
| [`biomechanics.ts`](../src/physics/biomechanics.ts) | COM korzysta z tej samej kinematyki nóg i tułowia co szkielet. | Rozkład mas, położenie masy rąk/głowy i środka masy sprzętu są przybliżeniami; nie są całkowaniem mas widocznej siatki. |
| [`simulation.ts`](../src/physics/simulation.ts) | Krok 1/120 s, osobny stan COM, reakcja podłoża ogranicza wybicie; zmiana pozy w powietrzu nie dodaje translacyjnego impulsu. | Orientacja ma dwa stopnie swobody, stałe bezwładności i uproszczony kontakt. Nie jest to pełna dynamika wieloczłonowa. |
| [`pose.ts`](../src/athlete/pose.ts) | Stałe długości kości, wspólna kinematyka, odrębne pochylenie tułowia i otwarcie V. | Przejście do lotu jest harmonogramem animacji; nie wynika z rozwiązania momentów w stawach. |
| [`rig.ts`](../src/athlete/rig.ts) | Narty obracają się ze sprzętem wokół swoich punktów mocowania; stosowane jest wspólne pochylenie tułowia. | Geometria wyposażenia nie jest modelem przepływu ani podatności nart, kombinezonu i mięśni. |
| [`windTunnel.ts`](../src/lab/windTunnel.ts) | Bezpośrednio wywołuje `aerodynamicForces`, bez osobnej tabeli współczynników laboratoryjnych. | Zakres suwaków jest zakresem diagnostyki modelu, a nie zakresem walidacji eksperymentalnej. |

## Układy odniesienia i jednostki

`+X` oznacza kierunek skoku, `+Y` pion, `+Z` kierunek poprzeczny; pozycje i długości są w metrach, czas w sekundach, masa w kilogramach, kąty wewnętrzne w radianach. Dodatni wiatr `X` to wiatr z tyłu, zmniejszający prędkość względną przy locie w `+X`. Znak oporu w odczycie tunelu jest zmieniany, aby pokazywać jego dodatnią wartość, chociaż wektor przy poziomym przepływie wskazuje w `−X`.

Three.js używa dla zawodnika obrotu Eulera `XYZ`: `rotation.set(roll, 0, pitch)`. Wynikowa macierz to `Rx(roll) Rz(pitch)`. Cięciwa i normalna w aerodynamice oraz `rotatedOffset` COM odpowiadają tej macierzy. Nie znaleziono rozbieżności kolejności obrotów między tymi trzema reprezentacjami. Lokalny kierunek tułowia ma kąt `pitch + π/2 − bodyLean`, zgodnie z `torso.rotation.z = −trunkLean` w szkielecie.

W tym zapisie `roll` obraca jednak wokół **światowego X**, a nie wokół chwilowej cięciwy pochylonych nart. `omega` i `rollRate` są prędkościami kątów Eulera. Pełna prędkość kątowa w świecie wynosiłaby dla tej konwencji `(rollRate, −omega sin(roll), omega cos(roll))`; nie należy przedstawiać dwóch zapisanych składowych jako niezależnych składowych wektora w osiach ciała. Brakuje yaw, równania Eulera dla tensorowej bezwładności oraz sprzężenia momentów. Na większe przechyły obecny model daje jedynie przybliżoną odpowiedź.

Kąt natarcia to `atan2(−u·normal, u·chord)`, nie sam kąt nart względem ziemi. Przy poziomym przepływie i zerowym przechyle równa się `pitch`. `bodyLean` jest pochyleniem tułowia od **lokalnego pionu nart**, nie od pionu świata. Suwak V oznacza półkąt jednej narty; pełny kąt pomiędzy nartami wynosi dwukrotność tej wartości. Porównanie artykułu i modelu musi ustalić te definicje przed użyciem danych.

## Powierzchnie i współczynniki

| Wielkość obecnego modelu | Wartość / definicja | Pochodzenie |
| --- | --- | --- |
| `S_skis` | `2 × 2.6 × 0.115 = 0.598 m²` | Prostokątna powierzchnia zastępcza nart, nie całkowanie ich zwężonego obrysu. |
| `S_body` | `0.489 m²` | Rzut unii trójkątów proceduralnego modelu w ustalonej pozycji; sprzęt wyłączony. Pomiar geometrii, nie pomiar siły. |
| Szerokość ciała | `0.452 m` | Geometria użyta przy oszacowaniu wydłużenia; nie zwalidowane wydłużenie aerodynamiczne człowieka. |
| `S_total` | `1.087 m²` | Mianownik zagregowanych `cl` i `cd`. |
| Długość odniesienia momentu | `1.45 m` | Założenie modelu. |
| Bezwładność pochylenia / przechyłu | `18 / 14 kg·m²` | Stałe szacunkowe, nie tensor wynikający z mas segmentów. |

Raportowane `cl` jest sumą skalarnych wkładów nośności, podzieloną przez `q S_total`. Dla różnych kierunków nośności przy przepływie bocznym nie musi równać się długości wektora sumarycznego podzielonej przez ten mianownik. Odczyt `L/D` w tunelu jest **podpisanym stosunkiem pionowej nośności do podłużnego oporu dla przepływu poziomego**. Ujemny wynik może być poprawny dla siły skierowanej w dół. Przy zerowym oporze fizyczny iloraz jest nieokreślony; interfejs powinien zaznaczyć tę sytuację. Maksimum L/D nie wyznacza samo w sobie najlepszej techniki skoku.

Przed porównaniem współczynników konieczna jest konwersja powierzchni: `C_target = C_source × S_source / S_target`. Dla momentu trzeba dodatkowo uzgodnić długość oraz punkt odniesienia. Po przeniesieniu momentu z punktu `O` do COM obowiązuje `M_COM = M_O + (r_O − r_COM) × F`; dopiero ten moment można dzielić przez `q S_target c_target`. Nie wolno bezpośrednio sumować lub porównywać współczynników z różnymi mianownikami i znakami osi.

## Wykryte ograniczenia fizyczne

1. **V nie zmienia oporu ani momentu pochylenia.** W obecnej implementacji mnoży nośność obu powierzchni przez `.88 + .12 clamp(vAngle/.25)`. Przy niezmienionym przepływie i pozostałej pozycji `cd` i `moment` są dokładnie takie same dla nart równoległych i otwartych. Nie ma osobnych sił, normalnych, momentów i prędkości na obu nartach, efektu interferencji, yaw ani zmiany charakterystyk bocznych. Otwieranie V w widocznym szkielecie jest rzeczywiste, ale wpływ aerodynamiki pozostaje tym prostym mnożnikiem.
2. **Moment pochylenia jest funkcją projektową.** `Cm = −.055 sin(2(alpha − trim)) − omega c/(2|u|)` z trymem zależnym liniowo od pochylenia tułowia. Nie wynika z punktów przyłożenia sił na ciele/nartach ani z opublikowanej charakterystyki momentu. Ujemne lokalne `dCm/dalpha` przy wybranym trymie to cecha tej funkcji, nie dowód stabilności prawdziwego zawodnika. Statyczna pochodna, tłumienie i odpowiedź dynamiczna wymagają odrębnego sprawdzenia.
3. **Kształt ciała zastępuje powierzchnia nośna.** Przybliżenie Helmbolda redukuje początkowe nachylenie Cl dla małego wydłużenia. Zastosowanie go do człowieka w kombinezonie, wraz z oddzielnym dodaniem nart, jest hipotezą modelu. Nie odwzorowuje wzajemnego oddziaływania przepływu, porowatości kombinezonu, ustawienia rąk i głowy ani zmian obrysu przy zgięciach stawów.
4. **Oderwanie i opór są szacunkowe.** Stałe `.35`, `.70`, limit Cl, gałąź `sin(2alpha)` i dodatki do Cd nie są dopasowane do danych. Poza małymi kątami są ekstrapolacją tej funkcji. Nie ma zmierzonej zależności od liczby Reynoldsa, prędkości, przejściowego oderwania i histerezy.
5. **Sterowanie lotem zmienia cel pozy bez limitu prędkości stawu.** Obecny `trim()` ogranicza zakres, ale nie szybkość zmiany pochylenia tułowia wynikającą z ruchu myszy. Następna iteracja powinna oddzielić polecenie gracza od rzeczywistego, ograniczonego szybkością stanu pozy, przy zachowaniu obliczanego COM. Nie należy naprawiać tego arbitralnym impulsem lotnym.
6. **COM i energia są zredukowane.** Udziały masy są założeniami, masa rąk/głowy leży na zastępczej osi tułowia, a COM sprzętu jest stały i nie śledzi zmiany V. `muscleWork = ∫ N v_normal dt` jest dodatnią pracą zastępczego napędu pryzmatycznego / wskaźnikiem pracy COM, a nie pomiarem sumy mocy mięśni lub momentów w stawach. Nie należy raportować go jako zwalidowanej energetyki człowieka.
7. **Kontakt jest próbkowany przy punkcie odniesienia wiązań.** Nie ma kontaktu ciągłego całej narty, oddzielnego pierwszego zetknięcia dwóch nart i sił podatności. Przyjęta energia absorpcji, tarcie i animacja po lądowaniu są założeniami. To może mieć większy wpływ na ocenę lądowania niż dalsze strojenie Cl.

Kontrolne wywołanie obecnego modelu dla `27 m/s`, `ρ=1.225 kg/m³`, natarcia `10°`, pochylenia tułowia `73°`, półkąta V `10°`, bez przechyłu i obrotu daje `q=446.5125 Pa`, pionową nośność około `249.4103 N`, opór `109.2474 N`, `L/D≈2.2830` i moment `−4.7958 N·m`. Są to odtwarzalne **wyniki funkcji**, nie zmierzone wartości fizyczne ani kryterium jakości skoku.

## Źródła naukowe i dostępność danych

Weryfikacja źródeł ma cztery poziomy: wpis bibliograficzny, przeczytany tekst metody, pozyskane dane liczbowe, niezależna walidacja. W tej iteracji nie pozyskano żadnej pierwotnej tabeli eksperymentalnej CL/CD/Cm i nie przypisano pomiarom żadnej stałej obecnego modelu.

| Punkt wejścia | Co faktycznie potwierdzono | Dostęp do metod / danych |
| --- | --- | --- |
| Barnes i in., 2022, [DOI 10.1177/17543371221111625](https://doi.org/10.1177/17543371221111625) | [Issue #2](https://github.com/damwach/WDSJ/issues/2) wskazuje ten DOI oraz 297 konfiguracji. Są to informacje dostarczone w zadaniu, nie niezależnie odczytane z artykułu. Tytuł i pełnej listy autorów nie zweryfikowano. | DOI i Crossref: `CONNECT 403 Forbidden`. Wyszukiwanie metadanych przez Europe PMC, NCBI, OpenAlex i Semantic Scholar również zablokowane przez politykę sieci. Metoda, definicje powierzchni i liczbowe polary nieprzeczytane. |
| Seo i in., 2004, [DOI 10.1007/BF02843971](https://doi.org/10.1007/BF02843971) | DOI wskazany przez Issue #2. Dostępny [wtórny wpis bibliograficzny](https://github.com/tcanabrava/computational_methods_ski/blob/db3aeb07cf2a27ad7ca4b2491217d2f92dd82d5f/README.typ) podaje: Seo K., Watanabe I., Murakami M., „Aerodynamic force data for a V-style ski jumping flight”, *Sports Engineering* 7(1), 31–39. To wskazówka bibliograficzna, nie weryfikacja publikacji pierwotnej. | DOI, Crossref, Europe PMC i OpenAlex: `CONNECT 403 Forbidden`. Nie uzyskano danych pomiarowych. |

Nie obchodzono proxy, nie wyłączano TLS i nie przedstawiano treści zablokowanego artykułu jako przeczytanej. Wtórny projekt edukacyjny nie jest źródłem eksperymentalnych współczynników. Rejestr prób i rozróżnienie pochodzenia zapisano w [`aerodynamic-sources.json`](reference/aerodynamic-sources.json). Pełne teksty lub udostępnione przez autorów zbiory danych pozostają potrzebne do dalszej kalibracji.

## Następny etap bez strojenia do metrów

1. **Najpierw zbiór danych.** Pozyskać legalnie dostępny pełny tekst / zestaw autorów, zachować surowe pomiary i licencję, zanotować DOI, wersję, tabelę/rysunek, model, skalę, prędkość, gęstość, obszar odniesienia, długość dla Cm, punkt momentu, definicje kątów i niepewności. Jeżeli trzeba odczytać wykres, zachować procedurę digitizacji i błąd odczytu. Brak tych informacji oznacza brak danych gotowych do kalibracji.
2. **Ujednolicić konwencje.** Oddzielić natarcie nart od natarcia tułowia, półkąt V od kąta pełnego, kąt biodra od pochylenia tułowia oraz kąt poślizgu bocznego od yaw. Przeliczyć force axes, powierzchnie i punkt momentu przed dopasowaniem.
3. **Dopasować wspólnie siły i moment.** Tam, gdzie pomiary to wspierają, stosować `CL/CD/Cm(alpha, trunk, hip, V, yaw)` z jednego zgodnego układu pomiarowego. Nie sumować niezależnych modeli ciała i nart z danymi całego zawodnika. Zakresy interpolowane, ekstrapolowane i nieobsługiwane muszą być jawne w API oraz tunelu. Dane o yaw i tłumieniu trzeba pozyskać osobno, jeżeli ich nie zawiera badanie.
4. **Sprawdzić dopasowanie i stabilność.** Wydzielić konfiguracje do oceny poza dopasowaniem; publikować błąd sił/momentów z jednostkami i niepewnością. Badać lokalne `dCm/dalpha`, pochodne względem V/tułowia oraz odpowiedź na zaburzenie. Nie mylić statycznej równowagi ze stabilnością dynamiczną.
5. **Walidować lot niezależnie.** Porównać co najmniej trzy zarejestrowane trajektorie z prędkością wybicia, wiatrem i pozą, używając błędów pozycji, czasu lotu, prędkości i orientacji. Dystans jest jedną obserwacją, nie celem dopasowania. Sprawdzić także zbieżność numeryczną wobec mniejszego kroku całkowania; zgodność przy 30/144 fps sama tego nie dowodzi.
6. **Ocenić grywalność osobno.** Rejestrować powtarzalne scenariusze identycznych wejść oraz rzeczywiste próby graczy. Strojenie czułości gestu, zakresów celu pozy i prezentacji można wykonywać bez zmiany tabel aerodynamicznych. Nie dopisywać sił, aby uzyskać oczekiwany wynik.

Do czasu ukończenia tych porównań wszystkie charakterystyki aerodynamiczne w tunelu są obliczeniami niezwalidowanego modelu zredukowanego. Certyfikat skoczni określa geometrię i parametry referencyjne, a nie aerodynamikę zawodnika.

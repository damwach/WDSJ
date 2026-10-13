# Physics Debugger — nagrania i replay

Panel otwiera się przyciskiem **Physics Debugger** po wykonaniu skoku. Wstrzymuje bieżący trening, a jego podgląd korzysta z osobnej instancji symulacji. Zamknięcie przywraca dokładny wcześniejszy stan pauzy i widok gry. Bieżący skok nie jest przewijany ani nadpisywany.

Nagranie zawiera próbkę każdego kroku `1/120 s`, wejścia gracza, warunki powietrza, stan zawodnika i diagnostykę sił. Suwak wybiera całkowitą klatkę; przyciski `−1` i `+1` przechodzą o jeden krok. Odtwarzanie stosuje zapisane wejścia do świeżej symulacji z tymi samymi parametrami. Przewijanie wstecz uruchamia ją od początku, a przewijanie w przód oblicza brakujące kroki. Ekran może przedstawiać kilka kroków naraz przy wolniejszej częstotliwości renderowania; żadna próbka fizyki nie jest pomijana.

Pełna walidacja porównuje wszystkie odtworzone pola i każdy krok z nagraniem. Tolerancja bezwzględna wynosi `1e-9` dla pól liczbowych w zapisanych jednostkach. Wynik oznacza zgodność numeryczną tej samej wersji silnika. Nie jest błędem pomiarowym ani potwierdzeniem naukowej poprawności modelu. Przy zmianie odcisku wersji fizyki, geometrii, schematu lub kroku czasowego import jest odrzucany.

## Wykresy i wektory

Wykresy pokazują moduły nośności i oporu w N, podpisany moment pochylający w N·m, kąt natarcia nart w stopniach oraz reakcję najazdu w N. Każdy wykres ma osobną opisaną skalę. Przy długim nagraniu w każdym przedziale rysowania zachowane są minimum i maksimum, aby nie ukryć krótkiego piku wybicia.

Nośność, opór, grawitacja i reakcja kontaktowa mają wspólną liniową skalę strzałek: **1 m = 400 N**. Nie przycinamy wartości sił. Siły są próbkowane na początku kroku i dla czytelności zaczepione przy położeniu COM na końcu tego kroku. To przesunięcie o jeden krok jest jawnie opisane w panelu.

Linia przerywana pokazuje pozycję COM zapisaną w nagraniu, a turkusowa — pozycję COM rzeczywiście ponownie obliczoną podczas walidacji. Zgodne linie nakładają się. Wektory i trajektorie można niezależnie wyłączyć.

Kąt natarcia poza lotem ma na wykresie wartość 0, ponieważ model nie oblicza tam tej diagnostyki aerodynamicznej. Kontakt lądowania jest zapisany jako impuls i prędkości przed oraz po zderzeniu, nie jako arbitralnie rozciągnięta w czasie siła. Model wybiegu nie rekonstruuje pełnej wektorowej reakcji więzów. Te ograniczenia nie powinny być interpretowane jako brak rzeczywistej siły podłoża.

## Import i eksport

Eksport zapisuje pełny, zwarty JSON wraz z metadanymi wersji, jednostkami i wejściami. Import sprawdza schemat, skończoność wartości, zgodność wersji i ponownie oblicza cały skok. Błędny plik wyświetla komunikat i zachowuje poprzedni poprawny replay. Panel ogranicza import pliku do 64 MiB; rejestrator dodatkowo ogranicza liczbę klatek i strukturę danych. Lista skoków umożliwia także otwarcie wcześniejszych prób zachowanych w pamięci bieżącej sesji.

Panel używa tego samego modelu, sceny, skoczka i kontekstu WebGL co gra. Nie dodaje osobnego modelu fizyki ani animacji. Na telefonie podgląd znajduje się nad przewijanym panelem, a na dużym ekranie obok niego.

Testy Playwright sprawdzają pełny nagrany skok, przewijanie, deterministyczny replay, odtwarzanie, pauzę, niezmienność bieżącego skoku, rzeczywisty eksport JSON, poprawny i błędny import oraz układ 390 × 844. Zrzuty `artifacts/debugger-*.png` dokumentują lot, lądowanie, obsługę błędu i widok mobilny.

# Zawodnik i ruch 0.7

Załączoną `skylift_3d_v03.html` uruchomiono w Chromium przez lokalny HTTP i obejrzano w najazdzie, wybiciu i locie. Jej mocne strony to czytelny czerwony tułów z ciemnymi nogawkami oraz wcześniejszy napęd kolan i późniejszy ruch bioder. W 0.6 figura była zbyt smukła, a tułów przy pełnym wyproście zbliżał się do pozycji stojącej. Oryginał zmieniał długości kończyn podczas interpolacji wierzchołków; tego rozwiązania nie przeniesiono.

## Model

Udo ma 0.44 m, podudzie 0.43 m, tułów 0.53 m, narty 2.60 m. Maksymalna szerokość powierzchni tułowia to około 0.38 m, głębokość 0.27 m, szerokość kasku 0.21 m. To proporcje projektowe dorosłego zawodnika, bez skanu konkretnej osoby.

`surfaces.ts` tworzy powierzchnie przez interpolowane przekroje owalne. Gładkie normalne na szwie usuwają pionowy ślad łączenia. Panele kombinezonu i numer startowy są geometrią, nie obrazem. Kolana i łokcie mają deformowane powierzchnie łączące segmenty; ich bufory są stałe i aktualizowane bez tworzenia siatek podczas animacji.

## Ruch

`pose.ts` jest jedyną definicją kinematyki dla renderowanego szkieletu i przybliżonego COM. Wyprost pozostaje skutkiem gestu i kontaktowego napędu fizycznego. Kolana rozpoczynają ruch przed biodrami i klatką. Przy pełnym wyproście tułów jest nachylony o około 41° od pionu względem nart; nie staje pionowo. Po wyjściu z progu klatka przechodzi do pozycji aerodynamicznej wcześniej niż nogi. Narty zaczynają otwierać się po około 0.12 s i osiągają docelowe V po około 0.52 s.

W przygotowaniu do lądowania dwusegmentowa kinematyka odwrotna rozstawia stopy wzdłuż nart, zachowując długości kości i ugięcie kolana. Po dotknięciu śniegu następuje szybkie, ograniczone wizualne ugięcie, a następnie wolniejsze odzyskanie pozycji. Kamera dodaje przesunięcie zawodnika przed wygładzeniem kadru, dzięki czemu nie pozostaje kilka metrów za nim.

## Granice

Nie użyto motion capture ani pomiarów biomechanicznych. Krzywe stawów, czasy przejścia, deformacja tkaniny i ugięcie po lądowaniu są procedurami animacyjnymi. W locie poza i COM są spójne, a krzywa ruchu nie dodaje siły wybicia. Po kontakcie animacja amortyzacji nie zastępuje wieloczłonowego solvera kontaktu. Upadek jest płynnym przechyłem i ślizgiem, bez ragdolla. To dopracowanie wizualne z kontrolą podstawowych ograniczeń kinematycznych, bez deklaracji naukowej walidacji ruchu.

Testy obejmują stałe długości kości, kontakt obu nart, brak przeprostów kolan, monotoniczny wzrost COM, odwzorowanie wysokości w napęd, kolejność pracy stawów, ciągłość przejść, amortyzację i interpolację niezależną od symulacji. Chromium zapisuje fazy 08–14 i izolowane pozy `athlete-{tuck,push,flight,telemark}.png` w `artifacts/`.

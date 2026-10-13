# Wielka Krokiew — wymiary HS140 / iteracja 0.8

Źródło: przekazany przez użytkownika [HS140_2022.pdf](reference/HS140_2022.pdf), certyfikat FIS **105 / POL 1**, wystawiony **09.12.2022**, ważny do **30.04.2028**. Dokument zachowano bez zmian. Parametry są zapisane w `src/world/certificate.ts`; kinematyka profilu w `src/world/hill.ts`. Jedna jednostka sceny to jeden metr, bez osobnego skalowania osi.

## Dane odczytane z certyfikatu

| Wielkość | Wartość |
| --- | --- |
| P / K / L = HS | 109 / 125 / 140 m |
| e1 / e2 / es | 97.80 / 77.00 / 20.80 m |
| t / s | 6.50 / 3.13 m |
| γ / α | 35° / 11° |
| r1 | 90 m |
| h / n | 62.37 / 107.76 m |
| h/n (wartość wydrukowana) | 0.575 |
| l1 / l2 | 16 / 15 m |
| βP / βK / βL | 37° / 34.30° / 31.30° |
| rL / r2L / r2 | 310 / 168 / 99.30 m |
| ZU | 89.11 m |
| a | 103 m; uwaga: sloping up 17° |
| b1 / bK / bU | 2.65 / 25.00 / 27.50 m |
| d / q — położenie wieży sędziowskiej | 84 / 35 m |
| v0 — referencja | 28.28 m/s |
| Belki | 34; adnotacja 68cm; stopień 36×50cm |

Wartość przy `a` odczytano z obrazu PDF jako **17°**, nie błędne OCR „47°”. Uwagi organizacyjne z certyfikatu nie są instrukcjami implementacji gry.

## Układ i odcinki

T, krawędź progu, ma (x,y)=(0,0). X jest poziomy w kierunku skoku, Y skierowany w górę; Z jest poprzeczny. K ma dokładnie (107.76,−62.37)m, a śnieg pod progiem S=(0,−3.13)m.

Najazd A–E1 jest prostą 35°, E1–E2 łukiem kołowym R90m, E2–T prostą 11° długości 6.50m. Przyjęto e1/e2 jako całkowitą długość toru do T, obejmującą próg. Daje to A=(−84.7369,46.6072)m i B=(−67.6986,34.6768)m. Start odbywa się z postoju; prędkość jest liczona z grawitacji i oporów.

Położenia P i L wyznaczono od K przez odcinki długości łukowej 16 i 15m. Funkcja kąta względem długości łuku interpoluje kąty i krzywizny: 1/310m przy P i K, 1/168m przy L. Między L i U zastosowano `R(θ)=99.3+(168−99.3)(θ/βL)^p`; wykładnik p≈2.80346 wynika z wymaganego spadku do ZU=89.11m. W U styczna jest pozioma, promień wynosi 99.3m.

Wybieg U–koniec ma **103m rzutu poziomego**, zgodnie z linią wymiarową `a`. Kontynuacja łuku R99.3m wyprowadza go z poziomu do 17°; dalszy odcinek wznosi się pod tym kątem. Szerokość dochodzi do 25m przy K i 27.5m przy U, potem jest stała. Wieża sędziowska ma x=84m, z=35m; jej architektura i otaczający teren są proceduralne.

| Punkt | x [m] | y [m] |
| --- | ---: | ---: |
| A | −84.7369 | 46.6072 |
| B | −67.6986 | 34.6768 |
| E1 | −40.8296 | 15.8630 |
| E2 | −6.3806 | 1.2403 |
| T | 0 | 0 |
| S | 0 | −3.1300 |
| P109 | 94.7597 | −53.0455 |
| K125 | 107.7600 | −62.3700 |
| L / HS140 | 120.3395 | −70.5377 |
| U | 180.8478 | −89.1100 |
| Koniec wybiegu | 283.8478 | −62.1569 |

![Profil, osie w metrach](../artifacts/hs140-profile.svg)

## Rekonstrukcja i niejednoznaczności

Certyfikat jest zestawieniem głównych parametrów, nie pełnym pomiarem ani plikiem CAD. Nie opisuje wszystkich krzywych i nie pozwala jednoznacznie odtworzyć całego obiektu.

- Brak kąta βS i szerokości b2: przyjęto odpowiednio 6° i 8m. S–P to wielomian piątego stopnia, dopasowany do pozycji, stycznej i krzywizny przy P. To jawne założenia `reconstruction`, oddzielone od danych `certificate`.
- Kąty, l1/l2 i jeden stały rL nie definiują dokładnie tego samego łuku kołowego: R310m z różnicą kątów 2.7° daje 14.61m zamiast 16m, a 3° daje 16.23m zamiast 15m. Dlatego odcinki mają zmienną krzywiznę, zachowując długości, kąty i promienie w punktach odniesienia. Nie twierdzimy, że to dokładna oryginalna krzywa konstrukcyjna.
- Z h/n wynika 0.578786, a wydrukowana wartość to 0.575. Zachowano obie dane; do geometrii użyto h i n. Nie przesuwano K, by ukryć tę różnicę.
- 33 odstępy po 68cm dają 22.44m, a es=e1−e2=20.80m. Belki umieszczono w paśmie A–B, z zachowaniem 34 miejsc; odległość wynosi około 63.03cm wzdłuż najazdu. Adnotacja 68cm pozostaje w danych źródłowych. Jej innej konwencji pomiarowej nie rozstrzygnięto.
- Oznaczenia odległości są zarejestrowane do P109/K125/L140. P–L jest długością łukową; łuk S–P (109.2401m) normalizuje się do 109m. Nie jest to pełny zestaw pomierzonych oficjalnych stacji metrowych. K125 nie oznacza x=125m.
- Krzywa wznoszącego się wybiegu, konstrukcje, las, góry, budynki i kształt terenu nie pochodzą z pełnego pomiaru. Wymiary obiektu z certyfikatu nie stanowią certyfikacji wirtualnej skoczni ani modelu fizyki.

## Kontrola

Testy sprawdzają długości najazdu i progu, R90, położenie K/S/U, kąty P/K/L, promienie odniesienia, długości P–K/K–L, ciągłość pozycji/stycznej, wznios 17°, szerokości i rejestrację odległości. Chromium porównuje rzeczywiste wierzchołki renderowanej powierzchni z funkcjami kolizji oraz sprawdza kadr pełnego obiektu w orientacji poziomej i pionowej. Najazd jest analityczny; zeskok korzysta z gęstej interpolacji Hermite’a; siatka renderingu ma krok około 0.5m.

`node scripts/export-hill.mjs` odtwarza [dane JSON](../artifacts/hs140-profile.json), w tym SHA-256 źródłowego PDF. `MPLCONFIGDIR=/tmp/skylift-mpl python3 scripts/plot-hill.py` odtwarza wykres SVG/PNG, wymagając Matplotlib. Równania i nadal niezwalidowane parametry lotu są w [PHYSICS.md](PHYSICS.md).

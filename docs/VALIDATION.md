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

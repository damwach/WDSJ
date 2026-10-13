# Walidacja iteracji 01

Wykonano w środowisku chmurowym, 2026-10-13:

- npm run build: TypeScript i bundling Vite zakończone poprawnie. Ostrzeżenie: pakiet JS około 515 kB przed gzip (134 kB po gzip), głównie Three.js.
- npm test: 5/5 testów fizyki.
- npm run test:visual: 2/2 testy w systemowym Chromium, rendering WebGL przez SwiftShader. Brak błędów JS i console.error w sekwencji najazdu/wybicia/lotu.
- Cztery zrzuty w artifacts/: gotowość, najazd, wyprost i przejście do V. Obrazy obejrzano; poprawiono orientację normalnych najazdu, teren pod drzewami i czytelność panelu.
- Sprawdzono wejście przez zdarzenia pointermove: jeden przycisk nie wywołuje wyprostu, oba przyciski zmieniają cel wyprostu i boczny mimośród.
- Uruchomiono serwer Vite na porcie 5173.

Nie wykonano: walidacji biomechaniki na motion capture, pomiarów sił, porównania Cl/Cd z tunelem aerodynamicznym, testów sprzętowych GPU, automatycznego porównania pikseli, pełnych testów lądowania. Opis modelu i ograniczeń w README.md.

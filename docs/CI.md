# Kontrola kodu i publikacja

Projekt korzysta z Node.js 22, TypeScript, Vite, Vitest i Playwright. Workflow
`game-checks.yml` sprawdza pull requesty do `main` i jest wywoływany przez
`pages.yml` przed publikacją zmian na `main` lub ręcznym uruchomieniem Pages.
Publikacja wymaga pomyślnego zakończenia całej kontroli, także testów WebGL.

Kontrola wykonuje kolejno:

1. `npm ci` z zatwierdzonego pliku blokady zależności.
2. `npm run build:standalone`: kontrolę typów, build Vite i samodzielny HTML,
   który wykorzystuje test działania bez sieci.
3. `npm test`: jednostkowe i deterministyczne regresje fizyki.
4. Instalację Chromium oraz zależności systemowych przez Playwright.
5. `npm run test:visual -- --reporter=line,html --trace=retain-on-failure`.

Ścieżka pobranego Chromium trafia do `CHROMIUM_PATH`; konfiguracja lokalna nadal
może korzystać z `/usr/bin/chromium`. Testy przeglądarkowe wykonują się kolejno
na Chromium z WebGL przez SwiftShader. Weryfikują działanie i geometrię oraz
zapisują obrazy do oceny. Nie zastępuje to oceny na karcie graficznej użytkownika
ani naukowej walidacji aerodynamiki.

Każdy przebieg publikuje artefakt `game-validation-<run_id>` ze zrzutami,
raportem Playwright i śladami nieudanych testów; retencja wynosi 14 dni. Przed
kontrolą usuwa istniejące PNG w tymczasowym checkoutcie runnera, aby nie
przedstawiać wcześniejszych obrazów jako wyniku nowego testu. Żaden krok
sprawdzający nie ma `continue-on-error`. `if: always()` dotyczy wyłącznie
zachowania materiałów diagnostycznych.

Po pomyślnej kontroli osobny job buduje dystrybucję z bazą `/WDSJ/`, a job
`deploy` publikuje ten artefakt na GitHub Pages. Runner jest przypięty do Ubuntu
24.04, aby migracja etykiety `ubuntu-latest` nie zmieniała zależności Chromium.

## Podgląd etapu przed połączeniem PR

Ręczne uruchomienie Pages pozwala opublikować przetestowany commit z otwartego
PR bez łączenia zmian gry z `main`. Workflow uruchamia się z `main`, a opcjonalne
pole `preview_ref` wskazuje kod do oceny. Przykład z pełnym SHA:

```sh
gh workflow run pages.yml --repo damwach/WDSJ --ref main \
  -f preview_ref=<pełny-SHA-commitu-etapu>
```

Job `revision` rozwiązuje wybrany ref tylko raz do niezmiennego SHA. Ten sam SHA
trafia do kontroli TypeScript, testów jednostkowych i Playwright oraz do builda
publikowanego na Pages. Błąd któregokolwiek testu blokuje build i wdrożenie.
Można podać nazwę gałęzi; do odtwarzalnej oceny zalecany jest pełny SHA.

Podgląd korzysta z istniejącej strony
[damwach.github.io/WDSJ](https://damwach.github.io/WDSJ/) i zastępuje jej aktualną
wersję do następnej publikacji z `main` lub kolejnego podglądu. Nie powstaje
osobny adres dla każdego PR. Odwrócenie podglądu polega na ponownym uruchomieniu
workflow z `main` bez `preview_ref`; pusty parametr wybiera commit uruchamianego
workflow (`github.sha`). Dla CLI należy jawnie użyć `--ref main`, a w interfejsie
Actions wybrać gałąź `main`. Domyślna gałąź repozytorium jest również `main`.
Automatyczny push do `main` działa jak dotychczas i publikuje commit tego pushu.

Zmiana nie dotyka reguł środowiska `github-pages`, polityki dopuszczonych gałęzi
wdrożenia ani sekretów. Sam workflow nadal działa z `main`; checkout kodu etapu
jest częścią kontroli i builda, nie połączeniem PR.

## Przyczyna wcześniejszego błędu Deno

Historyczny workflow `deno.yml` był szablonem dla innego stosu: instalował Deno
1.x, uruchamiał `deno lint`, a następnie `deno test -A`. W projekcie nie ma
konfiguracji ani API Deno; testy importują Vitest i Playwright z zależności npm,
a kod działa w przeglądarce lub Node.js.

API GitHuba dla [przebiegu 38419319010](https://github.com/damwach/WDSJ/actions/runs/38419319010)
potwierdza sukces instalacji Deno, błąd kroku `Run linter` i pominięcie `Run tests`.
Pobranie surowego logu z serwera wyników Actions było niedostępne w środowisku.
Dlatego dodatkowo odtworzono `deno lint --json` przy użyciu Deno 1.46.3 na
czystym archiwum dokładnie tego commitu
`64498fee9577308656b978189cef7e9d6476c10d`.

Reprodukcja zakończyła się kodem 1 i 63 diagnostykami:

| Reguła | Liczba | Przyczyna |
| --- | ---: | --- |
| `no-node-globals` | 1 | `process.env` w konfiguracji Playwright dla Node.js |
| `no-window` | 7 | Przeglądarkowy globalny obiekt `window` |
| `no-window-prefix` | 6 | Wywołania przeglądarkowego API przez `window` |
| `no-explicit-any` | 47 | Dostęp testów do debugowego API `window.SKYLIFT` |
| `no-unused-vars` | 2 | Niepotrzebne importy `height` i `landing` w teście ruchu |

Usunięto niepasujący workflow Deno i zastąpiono go kontrolą używanego stosu,
obejmującą także rzeczywistą przeglądarkę. Nie dodano wyjątków Deno ani
ignorowania błędów. Zbędne importy wskazane przez reprodukcję usunięto z testu.
Historyczne nieudane przebiegi pozostają dostępne w Actions.

# StrategieSpiel

Eigenes rundenbasiertes 4X-Strategiespiel im Browser nach dem Vorbild von
Polytopia – Low-Poly-3D mit Three.js, Styles wie im GameHub, als PWA
installierbar (auch iOS). Ein Spiel von Nicolas Brand (Startbildschirm und
Menü nennen ihn).

- Repo: https://github.com/n-brand/StrategieSpiel
- Online: https://n-brand.github.io/StrategieSpiel/ (GitHub Pages)
- Früher „Kleine Reiche“ (Ordner `C:\Source\3d-test`, ohne Git). Die
  Speicher-Schlüssel heißen weiter `kleine-reiche-*`, damit laufende Spiele
  und Einstellungen erhalten bleiben – nicht umbenennen.

## Regeln

- **Git nach `C:\Source\CLAUDE.md`:** Claude committet (Autor
  `227780975+n-brand@users.noreply.github.com`, ist lokal gesetzt), pusht
  aber nie selbst. Nach jedem Commit den Push-Befehl angeben:
  `git -C C:\Source\StrategieSpiel push`.
- **Nichts aus Polytopia übernehmen:** keine Grafiken, Töne, Daten, Texte
  oder Namen aus dem Original (`C:\Source\Anker Games\Polytopia` nur zum
  Anschauen). Eigene Namen (Nordlinge, Steinvolk, Ebenenreich,
  Sandreiter), eigene Grafik, eigene Töne.
- **Handy zuerst:** Grund-CSS gilt fürs Handy hochkant, darunter Handy quer
  und PC. Sichere Ränder (Notch) über `--sat/--sab/--sal/--sar`.
- Keine Abhängigkeiten, kein Build-Schritt: statische Dateien in `public/`,
  Three.js r170 per Importmap von jsDelivr.
- Befehle für den Nutzer: PowerShell, ohne `&&`, ein Befehl pro Block.

## Starten und Testen

```powershell
node C:\Source\StrategieSpiel\server.js
```

→ http://localhost:4178

```powershell
npm --prefix C:\Source\StrategieSpiel test
```

```powershell
node C:\Source\StrategieSpiel\tools\sim.mjs
```

`sim.mjs` lässt Computer gegeneinander spielen und prüft Regel-Invarianten
auf allen Kartentypen.

## Aufbau

- `public/js/game/` – reine Spiellogik ohne DOM (Regeln, Kartengenerator,
  Engine, KI, Zufall). Aktionen liefern Ereignislisten, die Ansicht spielt
  sie ab.
- `public/js/view/` – 3D-Ansicht (Szene, Kamera, Modelle, Brett,
  Vorschaubilder).
- `public/js/main.js` – Steuerung und Oberfläche; `ui/ui.js` – Icons,
  Toasts, Dialoge.
- `public/js/ui/techtree.js` – Forschungsbaum als Stern mit 2D-Icons
  (`techicons.js`);
  `techlayout.js` (Anordnung, ohne DOM, getestet) und `panzoom.js`
  (Verschieben/Zoomen mit Maus, Mausrad, Fingern).
- `public/js/audio.js` – Töne und Musik per Web Audio (keine Dateien).
  iOS spielt erst nach der ersten Berührung.
- `public/js/pwa.js`, `public/sw.js`, `public/manifest.webmanifest` –
  installierbare App.
- `tools/make-icons.mjs` – erzeugt alle Icons (`npm run icons`).
- `public/js/view/fire.js` – Feuer in besetzten Städten (Flammen, Funken,
  Rauch, Lichtschein).
- `tests/` – `node --test`.
- `.github/workflows/pages.yml` – bei jedem Push auf `main`: Tests, dann
  `public/` auf GitHub Pages veröffentlichen.

## PWA

- **Service Worker:**
  - Eigene Dateien kommen zuerst aus dem Netz, ohne Netz (oder nach 4 s)
    aus dem Speicher. Beim Entwickeln gibt es also keine veralteten Dateien.
  - Three.js und die Schrift kommen aus dem Speicher.
- **Neue Datei in `public/`:** in `ASSETS` in `sw.js` eintragen. Sonst
  schlägt `tests/pwa.test.mjs` fehl.
- **`VERSION` in `sw.js` erhöhen:** nur, wenn sich die Liste oder die
  Logik im Service Worker ändert.
- **Icons ändern:** in `tools/make-icons.mjs`, danach `npm run icons`.
- **iOS:** installieren nur über HTTPS (GitHub Pages), dann in Safari Teilen → „Zum Home-Bildschirm“. Der Startbildschirm zeigt
  dafür einen Hinweis; auf Android/PC gibt es einen „Installieren“-Knopf.

## GitHub Pages

- Eingestellt (Settings → Pages → Source „GitHub Actions“, nicht „Deploy
  from a branch“): Jeder Push auf `main` veröffentlicht automatisch. Online
  getestet am 2026-10-17 – Spiel startet, Service Worker aktiv.
- Schlägt `configure-pages` mit „Not Found“ fehl, ist Pages aus oder nicht
  auf „GitHub Actions“ gestellt; danach den Lauf neu starten.
- Alle Pfade sind relativ (`./`, `sw.js`, `icons/…`), daher läuft das Spiel
  auch unter `/StrategieSpiel/`.

## Stand (2026-10-17)

- **Spiel:**
  - 4 Stämme, 25 Techniken, Städte mit Stufen und Belohnungen, Ruinen,
    Nebel, Kampf mit Gegenangriff.
  - KI in vier Stufen (Leicht bis Verrückt).
  - Spielarten „30 Runden“ und „Eroberung“.
  - 4 Kartentypen (Pangäa, Trockenland, Kontinente, Inselwelt).
    Trockenland hat gar kein Wasser (`water: false` in `MAP_TYPES`), rundherum
    trockener Boden statt Meer.
- **Schiffe:** Hafen → Boot → Schiff (Segeln) → Schlachtschiff
  (Navigation). Die KI expandiert über das Meer.
- **Ton:** Effekte zu allen Aktionen, die man sieht. Ruhige Musik je Stamm.
  Schalter im Menü; auf dem Startbildschirm ein Lautsprecher-Knopf, der
  alles stummschaltet.
- **PWA:**
  - Manifest, Icons (eigene Insel mit Turm) und Service Worker.
  - Offline getestet: Spiel startet und läuft ohne Server.
  - Installieren-Hinweis für iOS und Android/PC.
- **Forschungsbaum:**
  - Neu als Stern um den eigenen Stamm, nach dem Vorbild des Originals,
    aber mit eigener Grafik.
  - Runde Knöpfe mit eigenen 2D-Icons im Website-Stil (`ui/techicons.js`:
    flache Farben, dunklere Kontur, weißer Glanz). Großzügige Abstände,
    ein Test prüft den Mindestabstand.
  - Lange Namen zweizeilig getrennt (`LABEL_BREAKS` in `techlayout.js`);
    nach dem Laden der Schrift wird jede Zeile nachgemessen und notfalls
    kleiner gesetzt, damit sie nicht an den Kreisrand stößt.
  - Verschieben und Zoomen mit Maus, Mausrad, Fingern und Knöpfen.
  - Antippen zeigt unten eine Detailkarte: Satz, wozu die Technik gut
    ist, und Liste aller Freischaltungen mit Kosten und Werten – aus den
    Regeln erzeugt (`ui/techinfo.js`), ein Test prüft die Vollständigkeit.
- **Figuren:**
  - Kantige Klötzchen-Figuren im Stil des Originals, aber eigene Entwürfe:
    großer Würfelkopf, große Waffen, keine Bodenplatte.
  - Stamm erkennbar an der Kopfbedeckung: Nordlinge Fellmütze und Bart,
    Steinvolk Steinhelm, Ebenenreich Strohhut, Sandreiter Kopftuch
    (`LOOKS` in `view/models.js`).
  - Schräg von vorn (3/4-Ansicht); in Booten sitzt eine Figur.
  - Eigene Einheiten, die noch dran sind, leuchten mit hellem Umriss.
    Ebenso Ressourcen, die man gerade nutzen kann (Technik, eigenes Gebiet,
    genug Sterne – `usableResource`).
- **Berge:** Felssockel mit flacher Oberseite (`MOUNTAIN_TOP`), Gipfel nach
  hinten gerückt – Figuren, Erz, Ruinen und Bergtempel stehen oben auf dem
  Sockel. Weiße Ziel-Punkte werden immer obenauf gezeichnet.
  Auf Bergen (mit Klettern): Sicht 2 Felder statt 1 (`SIGHT`/`MOUNTAIN_SIGHT`),
  Verteidigung ×1,5. Wer geschützt steht (Berg, Wald, Wasser, Stadt), zeigt ein
  Schild an der Lebensanzeige; die Einheitenkarte nennt Grund und Wirkung.
- **Straßen:** Jede Einheit hat eine Straßen-Reichweite (`road` in `UNITS`:
  Krieger/Bogen/Schwert/Gedankenformer 3, Reiter 5, Ritter 6, Verteidiger/
  Katapult/Riese 2) = max. Felder pro Zug auf Straßen. Bewegung als Budget
  (`MOVE_BUDGET` 840); Restschritt: solange etwas übrig ist, geht noch ein
  Feld – so führt eine Straße auch in ihrer Richtung weiter.
- **Bewegung:** Nur Berge beenden die Bewegung (und ein Feld neben einem
  Gegner) – Wald bremst nicht mehr, auch nicht im Waldland des Gegners.
- **Kampf:** Sieg im Nahkampf = Nachrücken in einer flüssigen Bewegung
  (`animCharge`: anstürmen, Gegner fliegt beim Aufprall weg).
- **Einnehmen:** Kann eine Einheit eine Stadt erobern oder ein Dorf
  einnehmen, steht ein gelber Knopf direkt über ihr – ein Tipp genügt.
  Steht ein Gegner in einer Stadt, brennt sie (langsame Flammen), bis er
  abzieht oder die Stadt einnimmt.
- **Karten:** Feld- und Stadtkarte zeigen nur Freigeschaltetes; Knöpfe als
  eine waagerecht scrollbare Reihe (am PC auch per Mausrad). Werte
  (Angriff, Abwehr, Bewegung, Straße, Reichweite …) als farbige Symbole.
- **Menü:** kompakt (Schalter statt großer Knöpfe), am PC 400 px breit.
  Neue Einstellung „Runde beenden bestätigen“ (Standard aus) mit Rückfrage,
  die nennt, wie viele Einheiten noch etwas tun können.
- **Hinweise:** Leuchten, „Weiß = ziehen“ und „Runde beenden“ richten sich
  danach, was eine Einheit wirklich noch tun kann (`isIdle`).
- **KI:** Im Modus „Eroberung“ enden Computerpartien mit Sieger
  (Simulation: 4 von 4, über 24 Partien 22). Der Rundenzähler läuft dort über 30 hinaus;
  das Spielende nennt die echte Runde.
- **Handy hochkant (2026-10-22):**
  - Auswahl-Karte kompakt: nur Bild, Name, Untertitel. Werte, Fähigkeiten
    und Hinweise (`.sheet-detail`) stehen hinter dem ⓘ-Knopf und öffnen
    sich als Fenster; quer und am PC stehen sie wie bisher in der Karte.
  - Aktionen als runde Symbol-Knöpfe mit Name und Preis darunter.
  - Forschungsdetails: Freischaltungen einklappbar (am PC offen).
  - Mehr Symbole statt Text: Hilfe als Symbolzeilen, Menü-Einstellungen
    mit Symbolen, Gegner-Tempo 1×/2×/4×, Fähigkeiten mit Symbol.
- **Auflösen:** erst mit Freigeist (`DISBAND_TECH`, `canDisband`).
- **Tests:** 127 Unit-Tests, Simulation ohne Regelverstöße.

## Offen

- 3D-Look weiter an den Stil des Originals annähern (Figuren sind
  erledigt; Karte, Bäume, Städte offen). Keine Original-Grafiken
  übernehmen, nur den Stil.
- iOS-Startbilder (`apple-touch-startup-image`) fehlen. Beim Start ist
  kurz eine einfarbige Fläche zu sehen.

## Verbesserungen (Vergleich mit Original-Screenshots, 2026-10-22)

Nur Aufbau und Bedienung übernehmen, keine Grafiken, Texte oder Namen.
Ungefähr nach Nutzen sortiert:

1. ~~Untere Leiste bei Auswahl ersetzen~~ – erledigt: Auf dem Handy
   hochkant blendet eine Auswahl „Forschung/Runde beenden“ aus
   (`.has-sheet`), die Karte rückt nach unten.
2. **Anweisung in der Auswahl-Karte:** Statt der Blase „Weiß = ziehen“ oben
   steht im Original eine Zeile in der Karte („Wähle ein Feld …“). Eine
   Zeile spart die Blase und erklärt den nächsten Schritt.
3. **Karte einklappen (Pfeil ⌄):** Die Infozeile lässt sich zuklappen, ohne
   die Auswahl zu verlieren. So sieht man die Ziele dahinter.
4. **Untere Leiste als runde Symbol-Knöpfe mit Beschriftung:** Menü,
   Statistik, Forschung, Runde beenden. Das Menü wandert von oben nach
   unten, die obere Leiste zeigt dann nur Zahlen.
5. **Obere Leiste schlanker:** Im Original nur Text mit kleiner
   Überschrift (Punkte, Sterne +Einkommen, Runde), ohne Kästen, mittig.
   Unsere Kästen sind gut lesbar, verdecken aber mehr.
6. **Neuer Bildschirm Statistik (im Spiel):** Spielart und Kartentyp,
   Rangliste aller Stämme mit Punkten, ausgeschiedene grau. Haben wir
   bisher nur am Spielende.
7. **Aufgaben/Erfolge:** eigene Ziele mit Fortschritt (z. B. Stadt auf
   Stufe 5, 10 Siege, alle Techniken, 5 Städte per Straße verbunden,
   100 Sterne). Eigene Namen wählen.
8. **Einheiten-Details erweitern:** Herkunftsstadt, Fortschritt bis zum
   Veteran (x/3 Siege), Kosten. Fähigkeiten als Chips oben, Werte als
   Liste mit Punktlinie.
9. **Stadt-Details:** ein Satz mit Sternen pro Runde und Punktwert, bei
   eroberten Städten früherer Besitzer. Beim Antippen die Stadtgrenze
   hervorheben.
10. **Ausbilden-Knöpfe:** Preis als kleines Abzeichen oben rechts am runden
    Bild statt Text darunter.
11. **Forschungsdetails:** Freischaltungen als runde Symbole, jedes mit
    eigenem ⓘ (zweite Ebene) statt Textliste. Unten ein fester Hinweis,
    dass Forschung mit jeder Stadt teurer wird und Philosophie sie
    verbilligt.
12. **Zugziele deutlicher:** Im Original markieren Ringe alle erreichbaren
    Felder großflächig. Unsere weißen Punkte sind bei weiter Zoomstufe
    klein.
13. **Einstellungen:** Lautstärke als Schieberegler statt nur an/aus.
    Schalter „Tipps anzeigen“ zum Ausblenden der Hinweis-Blasen.
14. **Stadt-Schild auf der Karte:** Einkommen (★) und Einwohner-Fortschritt
    direkt unter dem Namen, wie bei der Stufe.

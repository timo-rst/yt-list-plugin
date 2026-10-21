# YouTube Abo-Box Listenansicht (Chromium Extension)

Eine schlanke, performante Browser-Erweiterung für den **Brave Browser**, **Google Chrome**, **Microsoft Edge** und andere Chromium-basierte Browser, welche die klassische, übersichtliche **Listenansicht der YouTube Abo-Box** zurückbringt.

---

## 📸 Layout-Vergleich

### Standard YouTube (4-Kachel Grid)
```text
[ Kachel 1 ]  [ Kachel 2 ]  [ Kachel 3 ]  [ Kachel 4 ]
[ Kachel 5 ]  [ Kachel 6 ]  [ Kachel 7 ]  [ Kachel 8 ]
```
*Sehr unübersichtlich, Titel oft abgeschnitten, Videos werden leicht übersehen.*

### Mit dieser Erweiterung (Klassische Listenansicht)
```text
+-----------------------------------------------------------------------------------------+
|  [ THUMBNAIL ]   Video-Titel (vollständig & gut lesbar)                                 |
|  [   16 : 9  ]   Kanalname • 15 Tsd. Aufrufe • vor 2 Stunden                            |
|  [  (240px)  ]   Video-Beschreibung / Infobox-Snippet (erste Zeilen der Beschreibung)   |
|                  [Später ansehen] [Zur Playlist hinzufügen]                    [···]    |
+-----------------------------------------------------------------------------------------+
|  [ THUMBNAIL ]   Nächstes Video ...                                                     |
+-----------------------------------------------------------------------------------------+
```

---

## ✨ Features

- 📜 **Klassische Listenansicht:** Videos werden sauber untereinander mit flexibler Thumbnail-Größe links und vollständigen Metadaten rechts dargestellt.
- 📝 **Videobeschreibungs-Vorschau:** Zeigt automatisch die ersten Zeilen der Videobeschreibung (Infobox) direkt in der Abo-Box unter dem Kanalnamen und den Aufrufen an.
- 🎛️ **Nahtloser Umschalt-Button:** Direkt neben dem YouTube-Button **„Alle Abos“** befindet sich ein dezenter Umschalter (`[ ☷ Kacheln ]` wenn Liste aktiv ist, bzw. `[ ☰ Liste ]` wenn Kacheln aktiv sind), mit dem sich jederzeit zwischen Kachel- und Listenansicht wechseln lässt.
- ⚡ **Automatische Beschreibungsabschaltung:** Sobald auf Kacheln umgeschaltet wird, werden die Beschreibungen automatisch ausgeblendet und das native YouTube-Grid 1:1 wiederhergestellt.
- 📱 **Intelligentes Shorts-Handling:** 
  - YouTube Shorts-Regale bleiben als kompakte horizontale Reihe (`S S S S S`) erhalten und scrollen seitlich – kein vertikaler Riesenblock.
  - Optional können Shorts in den Einstellungen auch komplett ausgeblendet werden.
- ⚙️ **Konfigurations-Popup:**
  - **Live Thumbnail-Slider:** Thumbnail-Breite stufenlos von 160px bis 420px anpassen mit sofortiger Live-Vorschau.
  - **Beschreibungen ein-/ausschalten:** Vorschautexte nach Belieben aktivieren oder deaktivieren.
  - **Shorts ausblenden:** Schalter zum kompletten Verstecken von Shorts-Sektionen.
  - **On-Page Umschalter:** Umschalt-Button in der Abo-Box bei Bedarf ein- oder ausblenden.
- 🌓 **Natives YouTube-Design:** Nutzt YouTubes eigene Design-Tokens (Dark & Light Mode kompatibel).
- 🚀 **100% Sicher & Performant:** Kein Monkey-Patching, keine unendlichen DOM-Mutation-Loops, sichere CSP-Konformität (Manifest V3).

---

## 🚀 Installation

### 1. Repository klonen oder herunterladen
```bash
git clone https://github.com/timo-rst/yt-list-plugin.git
```
*(Oder als ZIP herunterladen und entpacken).*

### 2. In Brave / Chrome aktivieren
1. Öffne die Erweiterungsverwaltung deines Browsers:
   - **Brave:** `brave://extensions`
   - **Chrome:** `chrome://extensions`
   - **Edge:** `edge://extensions`
2. Aktiviere oben rechts den Schalter **Entwicklermodus** (*Developer mode*).
3. Klicke oben links auf **Entpackte Erweiterung laden** (*Load unpacked*).
4. Wähle den Ordner `yt_list_plugin` aus.
5. Öffne [https://www.youtube.com/feed/subscriptions](https://www.youtube.com/feed/subscriptions).
6. Deine Abo-Box wird sofort in der aufgeräumten Listenansicht angezeigt!

---

## 📁 Projektstruktur

```text
yt_list_plugin/
├── manifest.json              # Manifest V3 Konfiguration
├── content/
│   ├── content.js             # State-Management, SPA-Routing, Beschreibungs-Lader & Button-Injection
│   └── styles.css             # CSS Grid- & Flexbox-Layouts, Dark-Mode-Styles & Button-Design
├── popup/
│   ├── popup.html             # Einstellungs-Menü
│   ├── popup.css              # Styling des Einstellungsfensters
│   └── popup.js               # Live-Synchronisation der Optionen via chrome.storage
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── .gitignore                 # Ausgeschlossene Dateien (OS, IDEs)
└── README.md                  # Dokumentation und Anleitung
```

---

## 📄 Lizenz
MIT License - Frei zur privaten und kommerziellen Nutzung.

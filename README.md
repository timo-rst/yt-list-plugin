# YouTube Abo-Box Listenansicht (Brave / Chromium Extension)

Eine schlanke, performante Browser-Erweiterung für den **Brave Browser** (sowie Chrome & Chromium-basierte Browser), welche die klassische, übersichtliche **Listenansicht der YouTube Abo-Box** zurückbringt.

---

## 📸 Layout

Statt des unübersichtlichen 4-Kachel-Grids werden Videos als strukturierte horizontale Streifen untereinander dargestellt:

```text
+----------------------------------------------------------------------------------+
|  [ THUMBNAIL ]   Video-Titel (vollständig lesbar)                                |
|  [   16 : 9  ]   Kanalname • 15 Tsd. Aufrufe • vor 2 Stunden                     |
|  [  (240px)  ]   Kurzbeschreibung / Snippet des Videos                           |
|                  [Später ansehen] [Zur Playlist hinzufügen]             [···]    |
+----------------------------------------------------------------------------------+
```

---

## ✨ Features

- 📜 **Klassische Listenansicht:** Videos werden linear untereinander mit festem Thumbnail links und Metadaten rechts dargestellt.
- ⚡ **Nahtlose SPA-Kompatibilität:** Erkennt YouTubes Seitenwechsel (`yt-navigate-finish`) ohne Neuladen und greift ausschließlich auf `/feed/subscriptions`. Normale Seiten (Startseite, Suchergebnisse, Watch-Pages) bleiben unberührt.
- ♾️ **Infinite-Scroll-Support:** Neu geladene Videos ordnen sich dank `display: contents` sauber in den Fluss ein.
- 🎛️ **Umschalt-Button auf YouTube:** Direkt in der Leiste der Abo-Box kann zwischen Liste und Kacheln umgeschaltet werden.
- ⚙️ **Konfigurations-Popup:**
  - Thumbnail-Breite stufenlos per Slider anpassen (180px bis 360px).
  - Shorts-Regale in der Abo-Box optional komplett ausblenden.
  - On-Page-Umschalter aktivieren/deaktivieren.
- 🌓 **Dark- & Light-Mode:** Passt sich automatisch den nativen YouTube-Farbvariablen an.

---

## 🚀 Installation im Brave Browser

1. Öffne den **Brave Browser**.
2. Gib in die Adresszeile ein:
   ```text
   brave://extensions
   ```
3. Aktiviere oben rechts den Schalter **Entwicklermodus** (*Developer mode*).
4. Klicke oben links auf den Button **Entpackte Erweiterung laden** (*Load unpacked*).
5. Wähle diesen Projektordner aus:
   ```text
   /Users/timorichstein/random_projects/yt_list_plugin
   ```
6. Öffne nun YouTube:
   [https://www.youtube.com/feed/subscriptions](https://www.youtube.com/feed/subscriptions)
7. Die Abo-Box erscheint sofort in der neuen Listenansicht!

---

## 📁 Projektstruktur

```
yt_list_plugin/
├── manifest.json              # Manifest V3 Konfiguration
├── content/
│   ├── content.js             # SPA-Routing, Toggle-Button Injection & State-Management
│   └── styles.css             # CSS-Grid & Flexbox Transformationen
├── popup/
│   ├── popup.html             # Einstellungs-Menü
│   ├── popup.css              # Dark-Mode Styling für Einstellungen
│   └── popup.js               # Synchronisation via chrome.storage.sync
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

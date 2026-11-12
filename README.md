# mcp-node-notifier

Ein lokaler STDIO-MCP-Server für Desktop-Benachrichtigungen mit **node-notifier**. Er meldet erfolgreiche oder fehlgeschlagene Aufgaben, Rückfragen und Zwischenstände. Rückfragen können sich wiederholen, bis du **„Hab's mitbekommen“** anklickst.

Eigenständiges Projekt: keine Abhängigkeit von `mcp-windows-notify`. Keine Cloud, keine API-Schlüssel und kein KI-Aufruf für die Wiederholungen.

## Voraussetzungen

- Node.js **22.22.2+ innerhalb der 22er-Reihe**, **24.15.0+ innerhalb der 24er-Reihe** oder **26+** (Vorgabe von node-notifier 12).
- Windows, macOS oder Linux mit angemeldeter grafischer Sitzung.
- Linux: `notify-send` aus libnotify. Für eigene MP3s zusätzlich `ffplay` aus FFmpeg; für WAV alternativ `paplay`.

```sh
npm ci
npm test
node src/cli.js --config /pfad/config.json --check
```

Ohne `--config` werden die eingebauten Standardeinstellungen verwendet. Alternativ setzt `MCP_NOTIFIER_CONFIG` den Konfigurationspfad. `--check` prüft Einstellungen und vorhandene Assets ohne Meldung oder Audiowiedergabe.

## In Codex einbinden

Beispiel für die globale `~/.codex/config.toml` unter Windows:

```toml
[mcp_servers.node-notifier]
command = "D:/nodejs/node.exe"
args = ["D:/mcp-node-notifier/src/cli.js", "--config", "D:/mcp-windows-notify/config.json"]
cwd = "D:/mcp-node-notifier"
startup_timeout_sec = 20
tool_timeout_sec = 30
```

In anderen MCP-Clients den gleichen Befehl und dieselben Argumente als STDIO-Server eintragen. Anschließend den MCP-Server beziehungsweise den Client neu starten. In einem ChatGPT-Web-Chat wird diese lokale Codex-Konfiguration nicht automatisch geladen.

## Werkzeuge

### `notify`

Vier Meldungstypen:

- `success`: Aufgabe erfolgreich abgeschlossen, einmalig.
- `error`: Aufgabe fehlgeschlagen, einmalig.
- `waiting`: Agent wartet auf eine Antwort; Quittierungsbutton und optionale Wiederholungen.
- `info`: Zwischenstand oder Meilenstein, einmalig.

```json
{
  "kind": "waiting",
  "task_id": "chat-123:asset-import",
  "message": "Welche der beiden Importvarianten soll ich verwenden?",
  "repeat_minutes": 5,
  "repeat_mode": "both"
}
```

`task_id` muss für `waiting` vorhanden und für den Chat beziehungsweise die Aufgabe eindeutig sein. Eine neue Rückfrage mit derselben ID ersetzt die alte Erinnerung. `success` oder `error` mit derselben ID stoppt die alte Rückfrage ebenfalls. `info` lässt sie weiterlaufen.

Weitere Optionen:

- `title`: eigener Titel, sonst Titel aus dem Profil.
- `sound: false`: stumme Meldung.
- `repeat_minutes: 0`: Rückfrage nur einmal anzeigen; sonst mindestens 0,1 Minuten und maximal 1440 Minuten. Standard: 5 Minuten. Wiederholungen gelten nur für `waiting`.
- `repeat_mode`: `both`, `sound` oder `notification`. Die erste Rückfrage zeigt immer einen quittierbaren Hinweis. `sound` wiederholt danach nur die eigene Audiodatei und setzt eine konfigurierte Datei mit Lautstärke > 0 voraus.

Die Antwort enthält die Benachrichtigungs-ID. Das Werkzeug wartet **nicht** darauf, dass ein Mensch klickt oder der Ton fertig abgespielt wird. Es bestätigt die Einplanung; das Betriebssystem kann die sichtbare Anzeige trotzdem unterdrücken.

### `acknowledge_notification`

```json
{ "id": "die-id-aus-notify" }
```

Stoppt den Timer und eine laufende eigene Audiowiedergabe für genau diese Meldung. Der Button führt dieselbe Aktion aus. Bloßes Ausblenden, der Zeitablauf des Banners oder ein Klick auf den Meldungstext quittieren sie nicht. Im Windows-Benachrichtigungscenter eingeklappte Meldungen zuerst über den kleinen Pfeil neben der Uhrzeit aufklappen, um den Button zu sehen.

**Quittieren bedeutet nur „Hinweis gesehen“. Es ist keine Antwort, Zustimmung oder Ausführungsfreigabe für den Agenten.**

### `list_notifications`

Zeigt den Zustand der Meldungen dieser MCP-Verbindung: beispielsweise `active`, `acknowledged`, `superseded` oder `sent`, die Anzahl der Zustellungen und `last_error`. Auch erst später erkannte Anzeige- oder Audiofehler erscheinen hier. Behält aktive Meldungen und eine begrenzte Historie.

## Eigene Töne, Icons und Texte

`config.example.json` ist die portable Vorlage. Konfiguration und persönliche Assets dürfen außerhalb des Git-Projekts liegen, etwa so:

```text
D:/mcp-windows-notify/
  config.json
  audio/MortalKombat.mp3
  icons/success.png
  icons/error.png
  icons/waiting.png
  icons/info.png
  messages/waiting.txt
```

Beispielkonfiguration (die referenzierten Dateien müssen existieren):

```json
{
  "acknowledgeLabel": "Hab's mitbekommen",
  "repeatMinutes": 5,
  "repeatMode": "both",
  "audio": { "file": "audio/MortalKombat.mp3", "volume": 50, "maxSeconds": 4 },
  "profiles": {
    "waiting": {
      "title": "Deine Antwort wird benötigt",
      "icon": "icons/waiting.png",
      "audio": { "volume": 70 },
      "messageFile": "messages/waiting.txt"
    }
  }
}
```

- Relative Pfade beziehen sich auf den Ordner der Konfigurationsdatei, nicht auf das aktuelle Projekt.
- Eigene Töne: **WAV oder MP3**, Lautstärke **0–100**, Abspieldauer **0,1–60 Sekunden**. Die allgemeine Geräte-/Systemlautstärke bleibt die Obergrenze. Bei Datei-Wiedergabe bleibt der native Meldungston stumm.
- `file: null` verwendet den nativen Meldungston. Eine separate Lautstärke zwischen 1 und 100 lässt sich dabei nicht garantieren; dafür eine Datei angeben. `volume: 0` schaltet den Ton ab.
- Icons: lokale **PNG-Dateien**, maximal **1024 × 1024**, höchstens **200 KiB**. 256 × 256 mit Transparenz ist zweckmäßig. `icon: null` verwendet die Plattformdarstellung.
- Textvorlagen sind UTF-8-Dateien mit den optionalen Platzhaltern `{{task}}` und `{{message}}`. Es wird kein Code ausgeführt.
- Die Profile `success`, `error`, `waiting`, `info` können jeweils `title`, `icon`, `messageFile` und `audio` überschreiben.
- Audio, Icons und Texte werden bei jeder Zustellung erneut gelesen. Das Intervall einer bereits laufenden Erinnerung bleibt bis zu einer neuen `notify`-Anfrage gleich.

Persönliche Medien gehören nicht ins öffentliche Repository. `config.local.json` und `.local/` sind bereits von Git ausgeschlossen.

## Plattformunterschiede

- **Windows:** native Toasts über das mit node-notifier gelieferte SnoreToast. Ein eigener langlebiger Callback-Kanal hält die Quittierung auch nach dem Ausblenden des Banners erreichbar. Eigene Audiodateien spielt Windows MediaPlayer über einen versteckten PowerShell-Prozess ab; kein Konsolenfenster und keine Änderung der globalen Soundeinstellungen.
- **macOS:** node-notifier/terminal-notifier für Meldungen und Buttons, `afplay` für eigene Töne. Das Icon der sendenden App wird vom System bestimmt; eigene PNG-Meldungsicons werden dort von node-notifier nicht unterstützt.
- **Linux:** node-notifier/notify-send. Buttons und ihr Verhalten hängen vom Notification-Daemon und der libnotify-Version ab. Falls der Desktop keine Buttons anbietet, bleibt `acknowledge_notification` verfügbar. Eigene Töne benötigen einen der oben genannten Player.

„Nicht stören“, deaktivierte Benachrichtigungen, fehlende Berechtigungen, stummgeschaltete Ausgabegeräte oder eine nicht vorhandene grafische Sitzung können die Ausgabe verhindern. Das ist kein garantierter Zustellkanal.

## Lebensdauer und Test

Die Timer laufen lokal im MCP-Prozess und funktionieren auch während der Agent auf eine Antwort wartet. Es gibt **keinen Autostart-Dienst**. Wenn der MCP-Client den Server beendet, enden die Erinnerungen. Zustände werden nicht über Prozessneustarts hinweg wiederhergestellt. Mehrere MCP-Verbindungen haben getrennte Zustände.

Ein manueller Test zeigt eine Rückfrage mit 15-Sekunden-Intervall und endet nach dem Buttonklick, spätestens nach zwei Minuten:

```sh
npm run demo -- --config config.local.json
```

Mit `--silent` ohne Ton. Mit `--center-test` beträgt das Intervall zwei Minuten und die maximale Testdauer drei Minuten, damit sich der Klick auf die ausgeblendete Meldung im Windows-Benachrichtigungscenter prüfen lässt. `--debug` protokolliert zusätzlich Windows-Klickereignisse auf stderr.

Die automatischen Tests prüfen Timer, Quittierung, Aufgabenisolation, stille Meldungen, Fehlerzustände, Konfigurationsänderungen, Plattformargumente und die echte MCP-STDIO-Verbindung. macOS und Linux müssen zusätzlich auf den jeweiligen Desktops praktisch getestet werden.

## Grundlagen

- [node-notifier](https://github.com/mikaelbr/node-notifier)
- [SnoreToast](https://github.com/KDE/snoretoast)
- [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

Lizenz: MIT. Die Abhängigkeiten und mitgelieferten Plattformprogramme behalten ihre jeweiligen Lizenzen.

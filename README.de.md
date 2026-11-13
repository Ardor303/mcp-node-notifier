# mcp-node-notifier

[English](README.md) · **Deutsch** · [GitHub](https://github.com/Ardor303/mcp-node-notifier)

Desktop-Benachrichtigungen für deinen MCP-Agenten: mitbekommen, wenn eine Aufgabe fertig ist, eine Antwort gebraucht wird oder ein Meilenstein erreicht wurde.

<p>
  <img src="assets/icons/success.png" alt="Erfolg" width="64">
  <img src="assets/icons/error.png" alt="Fehler" width="64">
  <img src="assets/icons/waiting.png" alt="Rückfrage" width="64">
  <img src="assets/icons/info.png" alt="Zwischenstand" width="64">
</p>

- **Vier Meldungstypen:** Erfolg, Fehler, Rückfrage und Info.
- **Erinnerungen quittieren:** Ein Klick auf **„Hab's mitbekommen“** beendet die Wiederholung.
- **Anpassbar:** eigene Töne, separate Wiedergabelautstärke, Icons und Textvorlagen.
- **Lokale Timer:** Erinnerungen laufen im MCP-Prozess weiter, während der Agent auf eine Antwort wartet. Keine zusätzlichen Modellaufrufe, kein Benachrichtigungsdienst-Konto und kein API-Schlüssel.

Verwendet [node-notifier](https://github.com/mikaelbr/node-notifier) und das [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk). Windows ist praktisch getestet; die Anbindungen für macOS und Linux sind implementiert, benötigen aber noch Tests auf den jeweiligen Desktops.

## Installation

### 1. Node.js und npm installieren

Lade eine unterstützte **LTS-Version** von [nodejs.org](https://nodejs.org/en/download) herunter. Node.js 26 LTS eignet sich für eine neue Installation.

- **Windows:** Den `.msi`-Installer ausführen. npm und die PATH-Option aktiviert lassen, danach ein neues PowerShell-Fenster öffnen.
- **macOS:** Den `.pkg`-Installer ausführen und ein neues Terminal-Fenster öffnen.
- **Linux:** Auf der Downloadseite Linux auswählen und der Installationsanleitung für deine Distribution beziehungsweise deinen Versionsmanager folgen. Die installierte Version muss die folgende Voraussetzung erfüllen.

Installation prüfen:

```sh
node --version
npm --version
```

Unterstützte Node.js-Versionen: **22.22.2+ innerhalb der 22er-Reihe**, **24.15.0+ innerhalb der 24er-Reihe** oder **26+**, entsprechend der verwendeten node-notifier-Version. Weitere Hinweise stehen in der [npm-Installationsanleitung](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/).

### 2. Dieses Projekt herunterladen und Abhängigkeiten installieren

Über **Code → Download ZIP** in diesem Repository herunterladen, entpacken und ein Terminal im entpackten Projektordner öffnen. Alternativ [Git installieren](https://git-scm.com/downloads) und dieses Repository klonen. Die folgenden Befehle im übergeordneten Ordner ausführen, in dem der neue Ordner `mcp-node-notifier` entstehen soll:

```sh
git clone https://github.com/Ardor303/mcp-node-notifier.git mcp-node-notifier
cd mcp-node-notifier
```

Anschließend im Projektordner die Abhängigkeiten installieren:

```sh
npm ci
```

**Dadurch werden node-notifier, das MCP SDK und deren Abhängigkeiten automatisch mitinstalliert.** Ein `npm install -g node-notifier` oder eine zusätzliche Installation unseres MCP-Pakets ist nicht nötig. Es gibt keinen Build-Schritt; der MCP läuft direkt aus diesem Ordner. [`npm ci`](https://docs.npmjs.com/cli/v11/commands/npm-ci/) verwendet die eingecheckte Lockdatei.

Falls PowerShell unter Windows `npm.ps1` blockiert, in diesen Befehlen `npm.cmd` statt `npm` verwenden.

### 3. Linux: Desktop-Werkzeuge ergänzen

Die Benachrichtigungsprogramme für Windows und macOS werden mit node-notifier geliefert. Linux benötigt `notify-send`; für eigene MP3s zusätzlich `ffplay`. Unter Debian/Ubuntu:

```sh
sudo apt update
sudo apt install libnotify-bin ffmpeg
```

Andere Distributionen bieten diese Programme über ihre Paketverwaltung an. Für WAV-Dateien kann alternativ `paplay` verwendet werden. Aktionsbuttons benötigen libnotify 0.7.10+ und einen Benachrichtigungsdienst, der Aktionen unterstützt. Der MCP muss in deiner angemeldeten Desktop-Sitzung laufen.

### 4. Konfiguration wählen und testen

`config.example.de.json` im selben Ordner nach `config.local.json` kopieren. In PowerShell, Bash oder Zsh:

```sh
cp config.example.de.json config.local.json
node src/cli.js --config config.local.json --check
npm run demo -- --config config.local.json --lang de
```

Die Vorlage verwendet die vier mitgelieferten Icons und deinen System-Benachrichtigungston. **Eine Audiodatei ist nicht nötig.** Der Test erinnert alle 15 Sekunden, bis du **„Hab's mitbekommen“** anklickst, und endet spätestens nach zwei Minuten. Im Windows-Benachrichtigungscenter die Meldung über den kleinen Pfeil neben der Uhrzeit aufklappen, damit der Button sichtbar wird.

Für englische Titel und Buttons stattdessen `config.example.json` kopieren und die Demo mit `--lang en` starten. Ohne Konfiguration sind die eingebauten Standardtexte englisch. `--check` prüft Einstellungen und Dateien ohne Meldung oder Audiowiedergabe.

Ein bestimmtes Profil aus deiner `config.local.json` gezielt testen, zum Beispiel `customNotify`:

```sh
npm run demo -- --config config.local.json --lang de --profile customNotify
```

Mit `--profile` verwendet die Demo den konfigurierten Titel, das Icon, die Audioeinstellungen und eine eventuell hinterlegte Nachrichtenvorlage dieses Profils. `--lang` bestimmt nur den Demo-Nachrichtentext. Das Profil muss in der Konfiguration existieren; auch die eingebauten Namen `success`, `error`, `waiting` und `info` sind möglich. `waiting` erinnert im Test alle 15 Sekunden bis zur Bestätigung, höchstens zwei Minuten. Andere Typen werden einmal angezeigt; nach der Anzeige-/Audiophase beendet sich die Demo automatisch. Mit `--silent` lässt sich der Ton ausschalten. `--center-test` ist nur für `waiting` gedacht und erinnert alle zwei Minuten bei höchstens drei Minuten Testdauer; `--max-minutes 5` ändert die maximale Testdauer.

Jeder Demo-Aufruf startet einen eigenen Prozess mit dem Code aus dem aktuellen Repository und liest die angegebene Konfiguration frisch ein. Dafür muss kein MCP-Client laufen oder neu gestartet werden.

## Mit dem MCP-Client verbinden

Einen **lokalen STDIO-Server** einrichten. Der Befehl ist die Node.js-Programmdatei; die Argumente verweisen auf `src/cli.js` und deine Konfiguration. Absolute Pfade verwenden. Den Node.js-Pfad findest du in PowerShell mit `(Get-Command node).Source`, unter macOS/Linux mit `command -v node`.

Für Codex einen Eintrag in der benutzerweiten `~/.codex/config.toml` ergänzen. Beispiel mit Windows-Pfaden:

```toml
[mcp_servers.node-notifier]
command = "C:/Program Files/nodejs/node.exe"
args = ["D:/mcp-node-notifier/src/cli.js", "--config", "D:/mcp-node-notifier/config.local.json"]
cwd = "D:/mcp-node-notifier"
startup_timeout_sec = 20
tool_timeout_sec = 30
```

Alle Pfade an deine Installation anpassen. Unter macOS/Linux die dortigen absoluten Pfade verwenden. Andere lokale MCP-Clients erhalten denselben Befehl und dieselben Argumente in ihrer jeweiligen STDIO-Konfiguration. Danach den MCP-Server beziehungsweise den Client neu starten. Ein ChatGPT-Web-Chat lädt diese lokale Konfiguration nicht automatisch.

Beispielanweisung an deinen Agenten:

> Nutze node-notifier bei Abschluss, Rückfragen und den von mir gewünschten Meilensteinen. Wenn du eine Antwort brauchst, erinnere mich alle fünf Minuten, bis ich quittiere.

Der Agent ruft dieses Werkzeug auf; die Installation allein richtet keine automatischen Hooks für sämtliche Agentenereignisse ein.

## Werkzeuge

### Wie der Agent die Werkzeuge erkennt

Der Server beschreibt seine Werkzeuge direkt über MCP. Der Agent muss diese README nicht lesen, um sie zu entdecken.

- Bei der Initialisierung meldet der Server seine Werkzeug-Unterstützung und liefert Nutzungshinweise, unter anderem zu Aufgaben-IDs und dem Beenden von Erinnerungen.
- `tools/list` liefert `notify`, `acknowledge_notification`, `list_notifications` und `list_notification_profiles`, jeweils mit Beschreibung, JSON-Schema für die Argumente und Angaben zum Verhalten. Die Schemata beschreiben Parametertypen, Pflichtfelder und erlaubte Werte.
- `tools/call` ruft das ausgewählte Werkzeug auf. Der Server validiert die Anfragen zusätzlich, etwa die für Rückfragen erforderliche `task_id`.

Die aktuelle Version verwendet das initialisierungsbasierte MCP-Protokoll des SDK 1.32.2, bis zur Revision **2025-11-25**. Das neuere Protokoll 2026-07-28 ist noch nicht implementiert. Siehe die dazugehörige [MCP-Werkzeugspezifikation](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) und [Initialisierungsspezifikation](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle). Die tatsächlich verwendeten Definitionen stehen in [src/server.js](src/server.js).

Der Client stellt diese Beschreibungen dem Agenten bereit. Deine Anweisungen legen weiterhin fest, wann du Meldungen möchtest; die Werkzeugerkennung aktiviert noch keine automatischen Meldungen bei jedem Ereignis.

### `notify`

- `success`: „Aufgabe abgeschlossen“ — einmalige Erfolgsmeldung.
- `error`: „Aufgabe fehlgeschlagen“ — einmalige Fehlermeldung.
- `waiting`: „Deine Antwort wird benötigt“ — Quittierungsbutton und optionale Wiederholungen.
- `info`: „Zwischenstand“ — einmalige Meilensteinmeldung.

Mit `kind` ein Standardprofil auswählen oder mit `profile` ein konfiguriertes Profil anhand seines Namens. Eine dieser Angaben ist Pflicht. Ein benanntes Profil liefert seinen Meldungstyp selbst; werden beide Felder angegeben, müssen sie übereinstimmen.

```json
{
  "kind": "waiting",
  "task_id": "chat-123:asset-import",
  "message": "Welche der beiden Importvarianten soll ich verwenden?",
  "repeat_minutes": 5,
  "repeat_mode": "both"
}
```

Eine stabile `task_id` verwenden, die für den Chat beziehungsweise die Aufgabe eindeutig ist. Für `waiting` ist sie Pflicht. Eine neue Rückfrage derselben Aufgabe ersetzt die vorherige Erinnerung. Auch `success` oder `error` mit derselben Aufgaben-ID stoppt sie; `info` lässt sie weiterlaufen.

Optionale Einstellungen:

- `profile`: Profilname aus `list_notification_profiles`, beispielsweise `customNotify`.
- `title`: Titel aus dem Profil überschreiben.
- `sound: false`: diese Meldung stummschalten.
- `repeat_minutes`: nur für Rückfragen; `0` deaktiviert Wiederholungen, sonst 0,1–1440 Minuten. Standard: 5 Minuten.
- `repeat_mode`: `both`, `notification` oder `sound`. Die erste Meldung zeigt immer einen Quittierungsbutton. Reine Tonwiederholungen benötigen eine eigene Audiodatei, Lautstärke größer null und aktivierten Ton.

Das Werkzeug gibt sofort eine ID zurück und wartet weder auf die Wiedergabe noch auf einen Klick. Es bestätigt die Einplanung; Betriebssystemeinstellungen können die Anzeige trotzdem verhindern. Später erkannte Anzeige- oder Audiofehler erscheinen in `list_notifications`.

### `acknowledge_notification`

```json
{ "id": "die-id-aus-notify" }
```

Stoppt Wiederholungen und eine laufende eigene Audiowiedergabe für diese Meldung. Der Button führt dieselbe Aktion aus. Wegklicken, der Zeitablauf des Banners oder ein Klick auf den Meldungstext quittieren sie **nicht**.

**Quittieren bedeutet nur „Hinweis gesehen“. Es ist keine Antwort und keine Ausführungsfreigabe für den Agenten.**

### `list_notifications`

Mit `{}` aufrufen, um die Meldungen dieser MCP-Verbindung zu prüfen: Zustand, Zustellungsanzahl, Wiederholungseinstellungen und `last_error`. Zustände sind unter anderem `active`, `sent`, `acknowledged` und `superseded`.

### `list_notification_profiles`

Mit `{}` die Standardprofile und eigenen Profile der aktuellen Konfiguration abfragen. Zurückgegeben werden Name, Meldungstyp, Titel und optionale Beschreibung. Den zurückgegebenen `name` in `notify.profile` verwenden. Die Liste wird bei jedem Aufruf erneut aus der Konfiguration gelesen.

## Eigene Töne, Icons und Texte

Beide Beispielkonfigurationen funktionieren unverändert. Eigene Einstellungen in deiner Kopie `config.local.json` vornehmen.

### Eigene Profile ergänzen

Profilname und Meldungstyp sind getrennt. Beispielsweise kann `customNotify` ein Profil vom Typ `waiting` sein. Der Typ bestimmt das Verhalten: `waiting` unterstützt Erinnerungen und einen Quittierungsbutton; `success`, `error` und `info` erzeugen einmalige Meldungen.

Beide Beispielkonfigurationen enthalten dieses lauffähige Startprofil. In einer bestehenden Konfiguration seinen Eintrag unter `profiles` ergänzen:

```json
{
  "profiles": {
    "customNotify": {
      "kind": "waiting",
      "description": "Rückfragen während einer längeren Aufgabe, die eine Antwort benötigen.",
      "title": "Deine Antwort zu dieser Aufgabe wird benötigt",
      "audio": { "volume": 70, "maxSeconds": 8 }
    }
  }
}
```

Die vorhandenen Profile beibehalten. Ein eigenes Profil übernimmt Titel, Icon, Audio-Einstellungen und Textvorlage vom konfigurierten Standardprofil seines Typs (hier `waiting`) und überschreibt nur die selbst angegebenen Werte. Audio-Einstellungen übernehmen außerdem die globalen Standardwerte. `description` erklärt dem Agenten, wofür dieses Profil gedacht ist.

Für einen separaten Ton im `audio`-Objekt dieses Profils `"file": "assets/audio/NotifySound.mp3"` ergänzen, sobald diese Datei existiert. Auch `icon` und `messageFile` lassen sich überschreiben; alle Pfade beziehen sich weiterhin auf den Konfigurationsordner.

Der Agent kann anschließend `notify` so aufrufen:

```json
{
  "profile": "customNotify",
  "task_id": "chat-123:asset-import",
  "message": "Welche Importvariante soll ich verwenden?",
  "repeat_minutes": 5
}
```

Eine zusätzliche Angabe von `kind` ist nicht nötig. Bisherige Aufrufe wie `{"kind":"waiting", ...}` funktionieren weiterhin.

Namen unterscheiden Groß- und Kleinschreibung, beginnen mit einem ASCII-Buchstaben und enthalten bis zu 64 Buchstaben, Ziffern, Unterstriche oder Bindestriche. Eigene Namen benötigen einen `kind` aus `success`, `error`, `waiting` oder `info`. Die vier Standardnamen behalten ihre ursprünglichen Typen. Neue Profile und Einstellungen werden ohne Serverneustart eingelesen; ein geänderter Typ einer aktiven Erinnerung erfordert einen neuen `notify`-Aufruf.

### Eigenen Ton ergänzen

Deine Aufnahme unter `assets/audio/NotifySound.mp3` ablegen und den Abschnitt `audio` anpassen:

```json
{
  "audio": {
    "file": "assets/audio/NotifySound.mp3",
    "volume": 50,
    "maxSeconds": 4
  }
}
```

`NotifySound.mp3` ist ein optionaler Dateiname, **keine mitgelieferte Aufnahme**. Verwende deinen eigenen Ton oder eine Aufnahme, die du weitergeben darfst. Solange die Datei fehlt, `file: null` beibehalten.

- Audio: WAV oder MP3, Lautstärke **0–100**, Abspieldauer **0,1–60 Sekunden**. Geräte- und Systemlautstärke bleiben die Obergrenze.
- Bei eigener Datei bleibt der native Meldungston stumm. `file: null` verwendet den Systemton, dessen Lautstärke hier nicht separat regelbar ist. `volume: 0` schaltet den Ton aus.
- Jedes Profil kann `audio` überschreiben, etwa mit einer anderen Datei oder Lautstärke für Rückfragen.

### Ein anderer Ton pro Meldungstyp

Der oberste Abschnitt `audio` legt die Standardwerte fest. Jeder Eintrag unter `profiles` kann Datei, Lautstärke und Abspieldauer einzeln überschreiben. Der Agent wählt über `kind` ein Standardprofil oder über `profile` ein eigenes Profil; dieses bestimmt den konfigurierten Ton.

Beispiel mit deinen eigenen Aufnahmen unter den folgenden Pfaden:

```json
{
  "audio": { "file": null, "volume": 50, "maxSeconds": 4 },
  "profiles": {
    "success": {
      "audio": { "file": "assets/audio/Success.mp3" }
    },
    "error": {
      "audio": { "file": "assets/audio/Error.mp3", "volume": 75 }
    },
    "waiting": {
      "audio": { "file": "assets/audio/Waiting.mp3", "volume": 70, "maxSeconds": 8 }
    },
    "info": {
      "audio": { "file": "assets/audio/NotifySound.mp3", "volume": 35 }
    }
  }
}
```

Dieser Ausschnitt zeigt nur Audio-Einstellungen. Die `audio`-Einträge in deinen bestehenden Profilen ergänzen und deren Titel und Icons beibehalten. Verwende Pfade zu tatsächlich angelegten Dateien; diese Aufnahmen sind nicht enthalten.

Fehlende Werte eines Profils werden aus den allgemeinen Audio-Einstellungen übernommen: Erfolgsmeldungen verwenden im Beispiel Lautstärke 50 und maximal vier Sekunden. Mit `audio.file: null` im Profil wird der Systemton verwendet; `audio.volume: 0` schaltet diesen Meldungstyp stumm.

Die Audioauswahl erfolgt über das gewählte **Profil**, nicht über einen frei übergebenen Dateipfad im einzelnen `notify`-Aufruf. Ein Aufruf kann seinen Ton mit `sound: false` abschalten.

### Icons und Textvorlagen

- Enthaltene Icons: `assets/icons/success.png`, `error.png`, `waiting.png`, `info.png` — transparente PNGs mit 256 × 256 Pixeln.
- Eigene Icons müssen PNG-Dateien sein, maximal **1024 × 1024** und **200 KiB**. `icon: null` verwendet die Plattformdarstellung. macOS verwendet das Icon der sendenden App.
- Profile unterstützen `title`, `icon`, `audio` und optional `messageFile`. Eine UTF-8-Textvorlage darf `{{message}}` und `{{task}}` enthalten; es wird kein Code ausgeführt.
- Relative Pfade beziehen sich auf den Ordner der Konfigurationsdatei. Einstellungen und eigene Assets können auch anderswo liegen; dann die Pfade anpassen oder die referenzierten Dateien mitkopieren.
- Audio, Icons und Textvorlagen werden bei jeder Zustellung erneut gelesen. Das Intervall einer laufenden Erinnerung bleibt bis zu einer neuen `notify`-Anfrage gleich.
- Statt `--config` kann `MCP_NOTIFIER_CONFIG` den Konfigurationspfad vorgeben.

Weitere Angaben stehen bei den [Assets](assets/README.md) und in den [Lizenzhinweisen](THIRD_PARTY_NOTICES.md).

## Plattformverhalten und Fehlersuche

- **Windows:** SnoreToast erzeugt native Benachrichtigungen. Ein langlebiger Rückkanal verarbeitet Quittierungsklicks auch nach dem Ausblenden des Banners. Eingeklappte Meldungen aufklappen, um den Button zu sehen. Eigene Töne spielt Windows MediaPlayer über einen versteckten PowerShell-Prozess ab.
- **macOS:** terminal-notifier erzeugt Meldungen und Buttons, `afplay` spielt eigene Töne. Bei der ersten Nachfrage die Benachrichtigungsberechtigung erlauben. Eigene Meldungs-PNGs werden nicht unterstützt.
- **Linux:** notify-send erzeugt Meldungen und Buttons; `ffplay` oder `paplay` spielt Audio. Buttons, Verlauf und Schließen hängen vom Benachrichtigungsdienst ab. Das Werkzeug kann Erinnerungen auch stoppen, wenn der Desktop keinen Button anbietet.

Wenn nichts erscheint, den globalen Benachrichtigungsschalter, die Einstellungen der sendenden App und „Bitte nicht stören“ prüfen. Bei fehlendem Ton Dateipfad, Lautstärke und Ausgabegerät prüfen. Ein erfolgreicher `--check` bestätigt noch keine Desktop-Zustellung.

Die Timer laufen im MCP-Prozess, nicht in einem separaten Autostart-Dienst. Sie funktionieren während einer Rückfrage weiter, **solange der Client diesen Prozess laufen lässt**. Das Beenden des Servers stoppt die Erinnerungen; Zustände überleben keinen Neustart. Unterschiedliche MCP-Verbindungen haben getrennte Zustände.

## Entwicklung

```sh
npm test
npm run check:examples
npm pack --dry-run
```

Die automatischen Tests zeigen keine Meldungen und spielen keine Töne ab. Der vorbereitete GitHub-Actions-Workflow prüft Windows, macOS und Linux mit Node.js 22, 24 und 26. Manuelle Desktop-Tests bleiben ein eigener Schritt.

Demo-Optionen: `--silent`, `--lang en|de`, `--center-test` (zwei Minuten Intervall, drei Minuten Laufzeitlimit), `--max-minutes 1..15`, `--debug` (Windows-Ereignisdiagnose).

Siehe [CONTRIBUTING.md](CONTRIBUTING.md) und [CHANGELOG.md](CHANGELOG.md). Das Paket ist derzeit als privat markiert, um versehentliche npm-Veröffentlichungen zu verhindern; die beschriebene Installation aus dem Quellcode funktioniert trotzdem.

## Lizenz

[MIT](LICENSE) für Projektcode und enthaltene Icons. Abhängigkeiten und native Hilfsprogramme behalten ihre jeweiligen Lizenzen; siehe [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

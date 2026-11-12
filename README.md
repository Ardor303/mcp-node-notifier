# mcp-node-notifier

**English** · [Deutsch](README.de.md) · [GitHub](https://github.com/Ardor303/mcp-node-notifier)

Desktop notifications for your MCP agent: know when work finishes, when your input is needed, and when a milestone is reached.

<p>
  <img src="assets/icons/success.png" alt="Success" width="64">
  <img src="assets/icons/error.png" alt="Error" width="64">
  <img src="assets/icons/waiting.png" alt="Waiting for input" width="64">
  <img src="assets/icons/info.png" alt="Progress update" width="64">
</p>

- **Four notification types:** success, error, waiting and info.
- **Acknowledge reminders:** click **“Got it”** to stop a repeating reminder.
- **Make it yours:** custom sounds, per-tool playback volume, icons and message templates.
- **Local timers:** reminders run in the MCP process while your agent waits for an answer. No extra model calls, notification service account or API key.

Built with [node-notifier](https://github.com/mikaelbr/node-notifier) and the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk). Windows is manually verified; macOS and Linux adapters are implemented and still need desktop testing.

## Install

### 1. Install Node.js and npm

Download a supported **LTS version** from [nodejs.org](https://nodejs.org/en/download). Node.js 26 LTS is a suitable starting point.

- **Windows:** run the `.msi` installer. Keep npm and the PATH option enabled, then open a new PowerShell window.
- **macOS:** run the `.pkg` installer and open a new Terminal window.
- **Linux:** select Linux on the download page and follow its installation instructions for your distribution or version manager. Ensure the installed version meets the requirement below.

Verify the installation:

```sh
node --version
npm --version
```

Supported Node.js versions: **22.22.2+ within v22**, **24.15.0+ within v24**, or **v26+**, as required by the installed node-notifier version. See also the [npm installation guide](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/).

### 2. Download this project and install its dependencies

Use **Code → Download ZIP** on this repository, extract it, and open a terminal in the extracted folder. Alternatively, install [Git](https://git-scm.com/downloads) and clone this repository. Run the following commands from the parent folder where you want the new `mcp-node-notifier` folder to be created:

```sh
git clone https://github.com/Ardor303/mcp-node-notifier.git mcp-node-notifier
cd mcp-node-notifier
```

Then install the dependencies inside the project folder:

```sh
npm ci
```

**This installs node-notifier, the MCP SDK and their dependencies automatically.** You do not need `npm install -g node-notifier` or a separate installation of our MCP package. There is no build step; run it directly from this folder. [`npm ci`](https://docs.npmjs.com/cli/v11/commands/npm-ci/) uses the committed lockfile.

On Windows, if PowerShell blocks `npm.ps1`, use `npm.cmd` in place of `npm` in these commands.

### 3. Linux: add desktop tools

Windows and macOS notification helpers are included with node-notifier. Linux needs `notify-send`; custom MP3 playback also needs `ffplay`. On Debian/Ubuntu:

```sh
sudo apt update
sudo apt install libnotify-bin ffmpeg
```

Other distributions provide these tools through their package managers. For WAV playback, `paplay` is an alternative to `ffplay`. Action buttons require libnotify 0.7.10+ and a notification daemon that supports actions. Run the MCP in your logged-in desktop session.

### 4. Choose a configuration and test it

Copy `config.example.json` to `config.local.json` in the same folder. In PowerShell, Bash or Zsh:

```sh
cp config.example.json config.local.json
node src/cli.js --config config.local.json --check
npm run demo -- --config config.local.json --lang en
```

The example includes the four icons and uses your system notification sound. **No audio file is required.** The demo repeats every 15 seconds until you click **“Got it”**, or stops after two minutes. In Windows Notification Center, expand the notification using the small arrow next to its timestamp to reveal the button.

For German titles and buttons, copy `config.example.de.json` instead and use `--lang de` for the demo. The built-in defaults without a configuration are English. `--check` validates configuration and assets without showing a notification or playing sound.

## Connect your MCP client

Configure a **local STDIO server**. The command is your Node.js executable; the arguments point to `src/cli.js` and your configuration. Use absolute paths. Find Node.js with `(Get-Command node).Source` in PowerShell or `command -v node` on macOS/Linux.

For Codex, add an entry to your user-level `~/.codex/config.toml`. Example Windows paths:

```toml
[mcp_servers.node-notifier]
command = "C:/Program Files/nodejs/node.exe"
args = ["D:/mcp-node-notifier/src/cli.js", "--config", "D:/mcp-node-notifier/config.local.json"]
cwd = "D:/mcp-node-notifier"
startup_timeout_sec = 20
tool_timeout_sec = 30
```

Adjust all paths to your installation. On macOS/Linux, use the absolute paths on that machine. Other local MCP clients use the same command and arguments in their own STDIO configuration. Restart the MCP server or client after adding it. A ChatGPT web conversation does not automatically load this local configuration.

Example instruction for your agent:

> Use node-notifier when you finish, need my input, or reach a milestone I asked about. If you need an answer, remind me every five minutes until I acknowledge it.

This is a tool the agent calls; installing it alone does not add automatic hooks to every agent event.

## Tools

### `notify`

- `success`: “Task completed” — a one-time completion notification.
- `error`: “Task failed” — a one-time failure notification.
- `waiting`: “Your input is needed” — an acknowledgement button and optional repeats.
- `info`: “Progress update” — a one-time milestone notification.

```json
{
  "kind": "waiting",
  "task_id": "chat-123:asset-import",
  "message": "Which of the two import options should I use?",
  "repeat_minutes": 5,
  "repeat_mode": "both"
}
```

Use a stable `task_id` unique to the chat/task. It is required for `waiting`. A new waiting notification for the same task replaces the previous reminder. A `success` or `error` notification with the same task ID stops it too; `info` leaves it running.

Optional settings:

- `title`: override the configured profile title.
- `sound: false`: mute this notification.
- `repeat_minutes`: waiting only; `0` disables repeats, otherwise 0.1–1440 minutes. Default: 5 minutes.
- `repeat_mode`: `both`, `notification` or `sound`. The first delivery always shows an acknowledgement button. Sound-only repeats require a custom audio file, nonzero volume and sound enabled.

The tool returns an ID promptly, without waiting for playback or a human click. It confirms scheduling; OS settings may still suppress display. Later delivery or playback errors appear in `list_notifications`.

### `acknowledge_notification`

```json
{ "id": "the-id-returned-by-notify" }
```

Stops repeats and current custom audio for that notification. The button does the same. Dismissing the banner, letting it time out, or clicking its body does **not** acknowledge it.

**Acknowledgement means “I saw the notification.” It is not an answer or permission for the agent to proceed.**

### `list_notifications`

Call with `{}` to inspect notifications in this MCP connection: state, delivery count, repeat settings and `last_error`. States include `active`, `sent`, `acknowledged` and `superseded`.

## Custom sounds, icons and text

Both example configurations work as supplied. Edit your copy in `config.local.json`; it is ignored by Git.

### Add your own sound

Place your recording at `assets/audio/NotifySound.mp3`, then change the `audio` section:

```json
{
  "audio": {
    "file": "assets/audio/NotifySound.mp3",
    "volume": 50,
    "maxSeconds": 4
  }
}
```

`NotifySound.mp3` is an optional filename, **not a bundled recording**. Use your own recording or one you may redistribute. Leave `file: null` until the file exists.

- Audio: WAV or MP3, volume **0–100**, playback limit **0.1–60 seconds**. Device/system volume remains the upper bound.
- Custom-file playback silences the native toast sound. `file: null` uses the system sound, whose volume cannot be independently controlled here. `volume: 0` mutes sound.
- Each profile can override `audio`, for example a different file or volume for a waiting notification.

### Icons and message templates

- Included icons: `assets/icons/success.png`, `error.png`, `waiting.png`, `info.png` — transparent 256 × 256 PNGs.
- Replacement icons must be PNG, at most **1024 × 1024** and **200 KiB**. `icon: null` uses the platform default. macOS uses the sending app's icon.
- Profiles support `title`, `icon`, `audio` and optional `messageFile`. A UTF-8 text template may contain `{{message}}` and `{{task}}`; it executes no code.
- Relative paths resolve from the configuration file's folder. You can keep settings and personal assets elsewhere; adjust paths or copy the referenced assets with them.
- Audio, icons and templates reload on each delivery. An existing reminder's interval stays unchanged until a new `notify` call.
- `MCP_NOTIFIER_CONFIG` can supply the configuration path instead of `--config`.

See [asset details](assets/README.md) and [third-party notices](THIRD_PARTY_NOTICES.md). Personal audio is ignored by Git and excluded from the package.

## Platform behavior and troubleshooting

- **Windows:** SnoreToast supplies native notifications. A persistent callback channel handles acknowledgement clicks after the banner disappears. Expand collapsed notifications to reveal their button. Custom sound uses Windows MediaPlayer through a hidden PowerShell process.
- **macOS:** terminal-notifier supplies notifications/buttons; `afplay` plays custom audio. Allow notification permission when prompted. Custom notification PNGs are not supported.
- **Linux:** notify-send supplies notifications/buttons; `ffplay` or `paplay` plays audio. Button availability, history and closing behavior depend on the desktop daemon. The tool can stop reminders even if the desktop offers no button.

If nothing appears, check the global notification switch, the sender app's notification settings and Do Not Disturb. If there is no sound, check the configured file, volume and output device. A valid `--check` result does not prove desktop delivery.

Timers live in the MCP process, not a separate autostart service. They continue while the agent waits **as long as the client keeps that process running**. Closing the server stops reminders; state does not survive a restart. Different MCP connections have separate state.

## Development

```sh
npm test
npm run check:examples
npm pack --dry-run
```

The automated suite does not play sounds or open notifications. The GitHub Actions workflow is configured for Windows, macOS and Linux across Node.js 22, 24 and 26. Manual desktop testing remains separate.

Demo options: `--silent`, `--lang en|de`, `--center-test` (two-minute repeats, three-minute limit), `--max-minutes 1..15`, `--debug` (Windows event diagnostics).

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md). The package is currently marked private to prevent accidental npm publication; source installation works as described above.

## License

[MIT](LICENSE) for project code and included icons. Dependencies and native helpers retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

# Third-party notices

The project's own source and included status icons are offered under the [MIT license](LICENSE). Dependencies and their bundled native programs retain their own licenses.

## Direct dependencies

- **node-notifier 12.1.0** — MIT. [Source](https://github.com/mikaelbr/node-notifier), installed license: `node_modules/node-notifier/LICENSE`.
- **@modelcontextprotocol/sdk 1.32.2** — MIT. [Source](https://github.com/modelcontextprotocol/typescript-sdk), installed license: `node_modules/@modelcontextprotocol/sdk/LICENSE`.

## Native programs supplied by node-notifier

- **SnoreToast** — LGPL-3.0. [Source](https://invent.kde.org/libraries/snoretoast), [release sources](https://download.kde.org/stable/snoretoast/). The dependency contains unmodified builds; exact versions, origin and license are recorded under `node_modules/node-notifier/vendor/snoreToast/`.
- **terminal-notifier** — MIT, with an explicit exception for its bundled `Terminal.icns` app icon, which is copyright Apple. [Source](https://github.com/julienXX/terminal-notifier), full installed notice: `node_modules/node-notifier/vendor/terminal-notifier-LICENSE`.
- **notifu** — BSD 3-Clause. Installed notice: `node_modules/node-notifier/vendor/notifu/LICENSE`. Included upstream but not used by this project's notification adapters.

The repository does not copy or modify these native binaries; npm installs them with node-notifier. Keep upstream license notices with any redistributed dependency bundle.

## Project media

The four icons were generated specifically for this project with OpenAI's built-in image generation tool and exported as transparent 256 × 256 PNGs. Their prompt set is included in [assets/icons/prompts.json](assets/icons/prompts.json). No third-party icon pack was used.

No audio recording is bundled. `NotifySound.mp3` is an optional filename for a user-supplied recording. Personal audio and local configurations are excluded from Git and the npm package.

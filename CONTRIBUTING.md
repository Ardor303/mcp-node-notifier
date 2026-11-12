# Contributing

Thanks for helping improve mcp-node-notifier. English and German contributions are welcome.

## Development

Use a Node.js version supported by `package.json`, then run:

```sh
npm ci
npm test
npm run check:examples
npm pack --dry-run
```

There is no build step. Source files use JavaScript ES modules. Keep MCP stdout reserved for protocol messages; send diagnostics to stderr.

## Changes and pull requests

- Describe the problem, the resulting behavior and how you verified it.
- Keep [README.md](README.md) and [README.de.md](README.de.md) in sync. Localize example messages and button labels as well as surrounding prose.
- Use `config.local.json` or `.local/` for personal settings. Do not commit secrets, absolute personal paths, local logs or test recordings.
- Add tests for timer behavior, cancellation, platform integration or other substantive behavior changes. Automated tests must not show notifications or play audio.
- Desktop behavior needs manual checks on the affected platform. Passing CI alone does not confirm that a banner, sound or action button works.
- Audio files in `assets/audio/` are ignored by default. Include a distributable sound deliberately only after documenting its origin and license. Do not rename a third-party recording and treat that as new content.

## Reporting problems

Include your OS, desktop environment if relevant, Node.js version, the command or MCP call, expected behavior and actual behavior. Attach a minimal redacted configuration. For Windows button problems, expand the notification first; a body click does not acknowledge a reminder.

## Dependency and release changes

Commit `package.json` and `package-lock.json` together when changing dependencies. Review packaged contents with `npm pack --dry-run`; keep personal files out of both Git and the package. Record user-visible changes in [CHANGELOG.md](CHANGELOG.md).

The package currently has `private: true` to prevent accidental npm publication. A public Git repository does not require removing that setting. Repository URLs and release badges should only be added once their actual destinations exist.

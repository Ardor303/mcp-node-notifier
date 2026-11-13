# Changelog

## Unreleased

- Select built-in or custom profiles in the standalone demo with `--profile`, preserving their configured title, icon, audio and message template.
- Named custom notification profiles with explicit kinds and inheritance from the configured built-in profiles.
- Optional `notify.profile` selection and `list_notification_profiles` for live profile discovery. Existing `kind` calls remain supported.
- Configuration checks now include custom profile assets and reject unknown or mismatched profile selections.
- English and German installation guides, localized configuration examples and demo messages.
- Four generated status icons and an optional `NotifySound.mp3` convention.
- Repository contribution guidance, third-party notices, issue templates and cross-platform CI configuration.
- Explicit package file allowlist and personal-media exclusions.
- English built-in notification titles and acknowledgement label. Existing configurations can override every label; the German example retains German messages.

## 0.1.0 — 2026-11-12

- Local STDIO MCP server with success, error, waiting and info notifications.
- Configurable reminder intervals and acknowledgement buttons.
- Custom WAV/MP3 playback with volume and duration settings.
- Profile icons and message templates, reloaded for each delivery.
- Windows callback support for notifications in Notification Center, with macOS and Linux adapters.
- Automated timer, configuration, platform-adapter and MCP protocol tests.

This records local project history; it does not imply that an npm package or GitHub release has been published.

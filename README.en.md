[繁體中文](README.md) · [简体中文](README.zh-CN.md) · **English** · [日本語](README.ja.md) · [한국어](README.ko.md)

<p align="center">
  <img src="assets/icon.png" alt="Daybook icon" width="88">
</p>

<h1 align="center">日序 · Daybook</h1>

<p align="center">I built a simple Windows desktop planner and to-do app.<br>Works offline. No login. Your data stays on your computer.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Windows-x64-0078D4" alt="Windows x64">
  <img src="https://img.shields.io/badge/Offline-ready-39845B" alt="Works offline">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-8B5CF6" alt="MIT License"></a>
</p>

![Daybook overview: schedule, completed items and theme switch](docs/images/daybook-overview.png)

## Install

1. Open the [download page](https://github.com/Casanova033822/daybook-secretary/releases/latest) and download **`Daybook-Setup-<version>.exe`**.
2. Run the installer, follow the prompts, then launch **日序 (Daybook)**.

For **Windows x64**, currently tested on Windows 11 x64. No Node.js or account needed. Once installed, the app works entirely offline.

> The installer is not code-signed, so Windows may show a security warning. Download only from this project's Releases page. Do not run files from an uncertain source.

## Features

- Day, week and month views, to-dos and recurring schedules.
- Start and end reminders with desktop cards and sound.
- Mini window, always-on-top mode and system tray support.
- Light and dark themes, 14 languages and saved preferences.

## Quick start

1. **Add an item:** Enter a name or pick a preset, such as meditation, workout or breakfast.
2. **Set a time:** Choose start and end times, add reminders or repeats if needed, then save. No time yet? Choose **Save as to-do**.
3. **Check your day:** Switch between day, week and month views. Tick the box on the left when something is done, or click the pencil to edit it.
4. **Make it yours:** Manage presets, language and default reminders in **Preferences**. Switch light and dark themes above **Add item**.

**Keep Daybook running to receive reminders.** Closing the window leaves it in the system tray. Reminders stop when you quit the app or shut down your computer.

<p align="center">
  <img src="docs/images/daybook-reminder2.png" alt="Daybook desktop reminder card" width="502">
</p>

## Privacy & license

I don't collect your schedules. There are no ads, telemetry or cloud sync. Data is stored locally without encryption; please keep your own backups. See [security and privacy (Traditional Chinese)](SECURITY.md).

I've released this project under the [MIT License](LICENSE). You're welcome to use, modify and share it, including commercially. Third-party components retain [their own licenses](THIRD_PARTY_NOTICES.md).

Questions or suggestions? [Let me know](https://github.com/Casanova033822/daybook-secretary/issues).

<details>
<summary>Run from source (developers)</summary>

Requires Windows x64, Git and Node.js 24.x. The initial download and dependency installation need an internet connection.

```powershell
git clone https://github.com/Casanova033822/daybook-secretary.git
cd daybook-secretary
npm ci
npm run build
npm start
```

Develop: `npm run dev`. Package: `npm run dist`. See the [release guide (Traditional Chinese)](RELEASING.md).

</details>

[繁體中文](README.md) · [简体中文](README.zh-CN.md) · **English** · [日本語](README.ja.md) · [한국어](README.ko.md)

<p align="center">
  <img src="assets/icon.png" alt="Daybook icon" width="88">
</p>

<h1 align="center">日序 · Daybook</h1>

<p align="center">A simple Windows planner for your schedule and to-dos<br>Works offline, needs no login, and keeps your data on your computer</p>

<p align="center">
  <img src="https://img.shields.io/badge/Windows-x64-0078D4" alt="Windows x64">
  <img src="https://img.shields.io/badge/Offline-ready-39845B" alt="Works offline">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-8B5CF6" alt="MIT License"></a>
</p>

![Daybook overview: schedule, completed items and theme switch](docs/images/daybook-overview.png)

## Install

1. Open the [download page](https://github.com/Casanova033822/daybook-secretary/releases/latest) and grab **`Daybook-Setup-<version>.exe`**.
2. Run the installer, follow the prompts, and open **日序 (Daybook)**.

Daybook supports **Windows x64** and is tested on Windows 11 x64. You don't need Node.js or an account, and the app works completely offline once installed.

> The installer is not code-signed, so Windows may show a security warning. Download only from this project's Releases page. Do not run files from an uncertain source.

## Features

- Day, week and month views, to-dos and recurring schedules.
- Start and end reminders with desktop cards and sound.
- Mini window, always-on-top mode and system tray support.
- Light and dark themes, 14 languages and saved preferences.

## Quick start

1. **Add something:** Type a name or pick one of your presets.
2. **Give it a time:** Choose when it starts and ends, then add a reminder or repeat if you want. No time yet? Save it as a to-do.
3. **Keep track:** Use the day, week or month view. Check the box when you're done, or click the pencil to make a change.
4. **Set it up your way:** Manage presets, language and reminders in **Preferences**. The light and dark switch sits right above **Add item**.

**Keep Daybook running to receive reminders.** Closing the window leaves it in the system tray. Reminders stop when you quit the app or shut down your computer.

<p align="center">
  <img src="docs/images/daybook-reminder2.png" alt="Daybook desktop reminder card" width="502">
</p>

## Privacy

I don't collect your schedules. There are no ads, telemetry or cloud sync. Your data stays on your computer without encryption, so keep a backup of anything important. See [security and privacy (Traditional Chinese)](SECURITY.md).

You can find the licenses for third-party components [here](THIRD_PARTY_NOTICES.md).

Questions or suggestions? [Let me know](https://github.com/Casanova033822/daybook-secretary/issues).

<details>
<summary>Run from source (developers)</summary>

You'll need Windows x64, Git and Node.js 24.x.

```powershell
git clone https://github.com/Casanova033822/daybook-secretary.git
cd daybook-secretary
npm ci
npm run build
npm start
```

Develop: `npm run dev`. Package: `npm run dist`. See the [release guide (Traditional Chinese)](RELEASING.md).

</details>

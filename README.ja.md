[繁體中文](README.md) · [简体中文](README.zh-CN.md) · [English](README.en.md) · **日本語** · [한국어](README.ko.md)

<p align="center">
  <img src="assets/icon.png" alt="Daybook のアイコン" width="88">
</p>

<h1 align="center">日序 · Daybook</h1>

<p align="center">私は、シンプルな Windows 向けの予定・タスク管理アプリを作りました。<br>オフラインで使えて、ログインは不要。データは自分のパソコンに保存されます。</p>

<p align="center">
  <img src="https://img.shields.io/badge/Windows-x64-0078D4" alt="Windows x64">
  <img src="https://img.shields.io/badge/Offline-ready-39845B" alt="オフライン対応">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-8B5CF6" alt="MIT License"></a>
</p>

## インストール

1. [ダウンロードページ](https://github.com/Casanova033822/daybook-secretary/releases/latest)から **`Daybook-Setup-バージョン.exe`** をダウンロードします。
2. インストーラーを開き、画面の案内に従ってインストールしたら、**「日序（Daybook）」** を起動します。

**Windows x64** 向けです。現在は Windows 11 x64 でテストしています。Node.js やアカウント登録は不要で、インストール後は完全にオフラインで使えます。

> インストーラーにはコード署名がないため、Windows のセキュリティ警告が表示される場合があります。このプロジェクトの Releases からのみダウンロードし、出所が不明なファイルは実行しないでください。

## 主な機能

- 日・週・月表示、タスク管理、繰り返し予定。
- デスクトップカードと通知音による開始・終了のリマインダー。
- ミニウィンドウ、最前面表示、システムトレイでの常駐。
- ライト／ダークモード、14 言語対応、設定の自動保存。

## 使い方

「予定を追加」を押し、名前と時間を入力して保存します。時間が未定なら「やることとして記録」を選びます。テーマは追加ボタンの上、言語は「環境設定」で変更できます。

**通知を受け取るには、Daybook を起動したままにしてください。** ウィンドウを閉じてもシステムトレイに常駐します。アプリを完全に終了した場合やパソコンの電源を切った場合は通知されません。

## プライバシーとライセンス

私は予定データを収集しません。広告、テレメトリー、クラウド同期もありません。データは暗号化されずにパソコン内に保存されるため、ご自身でバックアップしてください。詳しくは[セキュリティとプライバシー（繁体字中国語）](SECURITY.md)をご覧ください。

このプロジェクトは [MIT ライセンス](LICENSE)で公開しています。商用を含め、利用・改変・共有を歓迎します。第三者のライブラリや素材には[それぞれのライセンス](THIRD_PARTY_NOTICES.md)が適用されます。

不具合やご提案があれば、[お知らせください](https://github.com/Casanova033822/daybook-secretary/issues)。

<details>
<summary>ソースコードから実行する（開発者向け）</summary>

Windows x64、Git、Node.js 24.x が必要です。初回のダウンロードと依存パッケージのインストールにはインターネット接続が必要です。

```powershell
git clone https://github.com/Casanova033822/daybook-secretary.git
cd daybook-secretary
npm ci
npm run build
npm start
```

開発：`npm run dev`。パッケージ作成：`npm run dist`。詳しくは[リリース手順（繁体字中国語）](RELEASING.md)をご覧ください。

</details>

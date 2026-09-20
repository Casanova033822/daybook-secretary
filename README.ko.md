[繁體中文](README.md) · [简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · **한국어**

<p align="center">
  <img src="assets/icon.png" alt="Daybook 아이콘" width="88">
</p>

<h1 align="center">日序 · Daybook</h1>

<p align="center">저는 간단한 Windows 데스크톱 일정·할 일 관리 앱을 만들었습니다.<br>오프라인으로 사용할 수 있고 로그인은 필요 없습니다. 데이터는 내 컴퓨터에만 저장됩니다.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Windows-x64-0078D4" alt="Windows x64">
  <img src="https://img.shields.io/badge/Offline-ready-39845B" alt="오프라인 지원">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-8B5CF6" alt="MIT License"></a>
</p>

## 설치

1. [다운로드 페이지](https://github.com/Casanova033822/daybook-secretary/releases/latest)에서 **`Daybook-Setup-버전.exe`** 를 다운로드합니다.
2. 설치 파일을 열고 안내에 따라 설치한 뒤 **日序 (Daybook)** 를 실행합니다.

**Windows x64** 용이며, 현재 Windows 11 x64에서 테스트했습니다. Node.js나 회원가입이 필요 없으며, 설치 후에는 완전히 오프라인으로 사용할 수 있습니다.

> 설치 파일에 코드 서명이 없어 Windows 보안 경고가 표시될 수 있습니다. 이 프로젝트의 Releases에서만 다운로드하고, 출처가 불분명한 파일은 실행하지 마세요.

## 주요 기능

- 일·주·월 보기, 할 일 관리 및 반복 일정.
- 데스크톱 카드와 알림음으로 시작·종료 시간 알림.
- 미니 창, 항상 위에 표시, 시스템 트레이에서 백그라운드 실행.
- 라이트·다크 모드, 14개 언어 및 설정 자동 저장.

## 사용 방법

「일정 추가」를 누르고 이름과 시간을 입력한 뒤 저장하세요. 시간이 정해지지 않았다면 「할 일로 기록」을 선택하세요. 테마는 추가 버튼 위에서, 언어는 환경설정에서 바꿀 수 있습니다.

**알림을 받으려면 Daybook을 계속 실행해 두세요.** 창을 닫아도 시스템 트레이에 남아 있습니다. 앱을 완전히 종료하거나 컴퓨터를 끄면 알림이 울리지 않습니다.

## 개인정보 및 라이선스

저는 사용자의 일정 데이터를 수집하지 않습니다. 광고, 사용 정보 수집(텔레메트리), 클라우드 동기화도 없습니다. 데이터는 암호화되지 않은 상태로 컴퓨터에 저장되므로 직접 백업해 주세요. 자세한 내용은 [보안 및 개인정보 안내(중국어 번체)](SECURITY.md)를 확인하세요.

저는 이 프로젝트를 [MIT 라이선스](LICENSE)로 공개합니다. 상업적 용도를 포함해 사용·수정·공유를 환영합니다. 외부 라이브러리와 자료에는 [각각의 라이선스](THIRD_PARTY_NOTICES.md)가 적용됩니다.

문제나 제안이 있다면 [알려주세요](https://github.com/Casanova033822/daybook-secretary/issues).

<details>
<summary>소스 코드로 실행하기 (개발자용)</summary>

Windows x64, Git, Node.js 24.x가 필요합니다. 처음 소스를 다운로드하고 의존성을 설치할 때는 인터넷 연결이 필요합니다.

```powershell
git clone https://github.com/Casanova033822/daybook-secretary.git
cd daybook-secretary
npm ci
npm run build
npm start
```

개발: `npm run dev`. 패키징: `npm run dist`. 자세한 내용은 [배포 절차(중국어 번체)](RELEASING.md)를 확인하세요.

</details>

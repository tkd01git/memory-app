# Shared Memories App

彼女との「やりたいこと」「やったこと」「日ごとの思い出」をまとめるための軽量Webアプリです。

## できること
- やりたいことリストの登録・削除
- やったことリストの登録・削除
- やりたいこと → やったこと への移動
- カレンダーで日ごとの記録確認
- 各日付に対して
  - タイトル
  - メモ
  - やったことの記述
  - 写真1枚
  を保存
- Google Drive への同期

## 構成
- `index.html` : UI 本体
- `css/styles.css` : スタイル
- `js/app.js` : フロントロジック
- `api/drive/*` : Google Drive OAuth / 保存API

## Drive 保存仕様
Google Drive 上に以下を作成します。
- `shared-memory-app/`
  - `memories-data.json`
  - `daily-photos/`
    - `YYYY-MM-DD.jpg` など

## 必要な環境変数
Vercel などで次を設定してください。
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

## デプロイの流れ
1. GitHub にこのフォルダを push
2. Vercel に import
3. 上記環境変数を設定
4. Google Cloud Console で OAuth 同意画面とリダイレクト URI を設定
5. `/api/drive/auth` 経由で Google Drive 連携

## 補足
今回の実装では、添付ZIPにあった Drive OAuth + JSON 保存の流れを踏襲しつつ、筋トレ記録用だった構造を思い出共有用に置き換えています。

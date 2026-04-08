# CLAUDE.md — ALF Setup Assistant

このプロジェクトは Channel Talk の ALF Task 設計を支援する Web アプリです。
Claude Code でバイブコーディングする際は以下のルールを厳守してください。

## Commands

```
Dev:       pnpm dev
Build:     pnpm build
Lint:      pnpm lint
Typecheck: npx tsc --noEmit
```

## 絶対禁止

1. **シークレットのハードコード禁止** — API キー・トークンは必ず `process.env` で参照
2. **`eval()` / `new Function()` 禁止**
3. **`dangerouslySetInnerHTML` 禁止**（Mermaid レンダリングのみ例外、sanitize 必須）
4. **TypeScript strict モード無効化禁止**
5. **`.env` ファイルのコミット禁止**（`.env.example` のみ）

## コーディング規則

- App Router を使用（Pages Router 禁止）
- 環境変数は `process.env` でサーバーサイドのみアクセス（`NEXT_PUBLIC_` 接頭辞なし）
- 新しい環境変数を追加したら `.env.example` にも追記
- コード完成後は `pnpm lint` と `npx tsc --noEmit` でエラーがないことを確認

## プロジェクト概要

### 6ステップのフロー
1. **入力** — MTG文字起こし or PDF + 利用システム選択（カート/WMS/OMS）
2. **AI分析・要件補完** — Claude API でフロー分析 → フォーム形式 Q&A
3. **フロー可視化** — Mermaid プレビュー + チャット修正
4. **検証** — validate_task.js を API Route で実行 → 自動 Step 5 遷移
5. **タスクエディタ** — React Flow ビジュアル編集 + 自然言語差分修正
6. **ダウンロード** — Task JSON ファイル出力

### プロンプト設計
- `prompts/core/` — 常時ロード（system_prompt, policies, schema）
- `prompts/knowledge/` — 常時ロード（8種ノードナレッジ）
- `prompts/analysis/` — Step 2 のみ
- `prompts/execution/` — Step 3〜5
- `prompts/templates/` — Step 1 の利用システム選択に応じて動的ロード

### API Routes
- `POST /api/analyze` — Step 2: 入力解析 + Q&A 生成
- `POST /api/generate` — Step 3: Task JSON 生成
- `POST /api/validate` — Step 4: validate_task.js 実行
- `POST /api/modify` — Step 5: 自然言語差分修正

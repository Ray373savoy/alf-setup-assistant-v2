# 複雑度測定（1〜3段階）

## 1段階：ワークフロー複雑度分析

以下の項目を測定します：
- **コアノード数**：`type: "code"`と`type: "agent"`ノードの個数（message、userChatInlineAction除外）
- **最大実行パス長**：開始ノードから`END_TASK`まで最も長いパス
- **分岐点数**：`next.type: "branch"`ノードの個数

> 📖 詳細計算方法：`task-complexity-analysis.md` - 1. ワークフロー複雑度 参照

## 2段階：技術的複雑度分析

以下の項目を測定します：
- **外部サービス連携数**：ユニークな外部ドメインの個数
- **API呼び出し数**：axios、fetch等のHTTPリクエスト個数
- **データ処理複雑度**：JSONパース、日付計算、配列/オブジェクト操作パターン
- **メモリ変数個数**：`memorySchema`配列の長さ
- **エラー処理スコア**：try-catch、状態検証、例外処理ロジック

> 📖 詳細計算方法：`task-complexity-analysis.md` - 2. 技術的複雑度 参照

## 3段階：ビジネスロジック複雑度分析

以下の項目を測定します：
- **Agentノードinstruction長**：すべてのagentノードのinstructionテキスト長の合計
- **Agentノードsteps個数**：すべてのagentノードのsteps配列項目数の合計
- **分岐条件複雑度**：filter.and/orのネスト深度、条件個数、演算子重み付け

> 📖 詳細計算方法：`task-complexity-analysis.md` - 3. ビジネスロジック複雑度 参照


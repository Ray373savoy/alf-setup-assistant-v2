# Create Task プロセス Entry

## 目的

- LLMを使用してChannelTalk Taskを設計（ダイアグラム）し、最終JSON（`task`、`taskEditorPosition`）を生成します。
- 最新のTaskバックエンドスキーマ（Node Types、Next Actions、Expression等）を遵守します。

## 進行フロー

1. **Task JSON生成** → `task`/`taskEditorPosition`を含む単一JSON産出
   - [node_creation.md](./subtasks/node_creation.md)
   - 合意された設計を基に実際にImport可能なJSONを生成します。
   - `code`、`agent`、`message`、`function`、`browserAutomation`等、適切なノードタイプを使用します。
2. **検証**
   - 生成されたJSONがスキーマルール（必須フィールド、参照整合性）を守っているか確認します。

## 運用指針

- 1段階でユーザーが「確定」「完了」と言うまでダイアグラムを修正します。
- 2段階では説明なしにJSONコードのみ出力するようにします。
- 生成されたJSONはAdmin API（`POST /admin/tasks`）またはImport機能を通じてシステムに登録できます。

## 入力テンプレート（要約）

- taskName：タスク名
- personaAndTrigger：トリガー条件およびボットの役割
- audienceFilter：ターゲット顧客フィルター
- memoryFields：使用する変数一覧
- nodesSpec：ノードフローおよび機能仕様
- layoutHint：（任意）グラフ配置ヒント

上記の順序でドキュメントを開いて進めてください。

## Knowledge参照（必須）

**Task JSON生成前に必ず以下のファイルを読んで熟知してください。**

ノードタイプ別作成法：
- [trigger.md](./knowledge/trigger.md) - トリガー作成法
- [agent.md](./knowledge/agent.md) - エージェントノード、完了条件
- [code.md](./knowledge/code.md) - コードノード、APIパターン
- [message.md](./knowledge/message.md) - メッセージノード
- [action.md](./knowledge/action.md) - 相談処理ノード
- [branch.md](./knowledge/branch.md) - 分岐条件、filter作成法
- [memory.md](./knowledge/memory.md) - memory使用法、memorySchema
- [context.md](./knowledge/context.md) - context.user、context.userChat

例：
- [examples/output/](./examples/output/) - Task JSON例

## Specs参照（必須）

**JSONスキーマとポリシーを必ず確認してください。**

- [spec-prod.md](../../../specs/task/definitions/spec-prod.md) - Task JSONスキーマ
- [task-policy.md](../../../specs/task/policies/task-policy.md) - Taskポリシー

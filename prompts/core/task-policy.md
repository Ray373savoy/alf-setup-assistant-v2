# Task Policy

## 1. 概要

### 1.1 定義

Taskはチャネルトーク内で実行できるワークフローグラフ（Workflow Graph）を意味します。
LLM（Agent）は基本的に良い回答を生成しますが、「注文キャンセル」や「配送先変更」のように一貫した手順と明確な実行フローが必要な作業をTaskを通じて実行します。

### 1.2 目的

- 顧客が定義した定型化されたフローを正確に実行
- LLMの幻覚（Hallucination）防止および一貫性保証

---

## 2. コア概念

### 2.1 トリガー（Trigger）

- **定義**：どの時点で該当Taskが実行されるかについての自然言語説明です。
- **動作**：LLMに実行可能なTaskリストとトリガー説明が提供され、LLMが対話コンテキストに合わせて適切なTaskを選択（Tool Call）して実行します。

### 2.2 ノード（Node）

Task進行の最小単位であり、大きく2つの類型に分類されます。

#### A. バックグラウンドノード（Background Node）

顧客（End User）とのインタラクションなしにシステム内部で即時実行されるノードです。

- **コードノード（Code Node）**：JavaScriptコードを実行。変数（Memory）読み取り/書き込み可能。（タイムアウト60秒）
- **ブラウザ自動化ノード**：Playwrightを利用したブラウザ操作。（タイムアウト120秒）
- **ユーザーチャットアクションノード**：ユーザーチャットに特定アクション（タグ追加、担当者配分等）を実行。
- **ファンクションノード（Function Node）**：カスタム関数、アプリ関数等の外部動作を実行。

#### B. カスタマーフェイシングノード（Customer Facing Node）

顧客とのインタラクションが必要なノードです。このノードは顧客と直接相互作用せず**必ずエージェントを通じてのみ**相互作用します。

- **エージェントノード**：エージェントに指示文（Instruction）を提供し、作業を一時停止します。エージェントがユーザーとの対話を完了したら再び作業を再開します。
- **メッセージノード**：ユーザーに決められたメッセージを発信します。

### 2.3 タスクセッション（Task Session）

- **生成**：Taskがトリガーされた時に生成されます。
- **維持**：Taskが1回実行される間維持される実行フローです。
- **終了条件**：
  1. トリガーしたALFセッションが終了した時
  2. これ以上遷移する次のノードがない時（End of workflow）
  3. 実行中にエラーが発生した時

### 2.4 メモリ（Memory）

- Taskセッション中に維持される一時変数ストレージです。
- コードノード、エージェントノードを通じて値を読み取りまたは書き込みできます。
- **制約**：`list`、`listOfNumber`タイプはユーザー入力を通じて直接アップデートできません（コードノード等で処理が必要）。

### 2.5 プロンプトデータバインディング（Prompt Data Binding）

エージェントノードの`instruction`内でTask Memoryの値を参照またはアップデートするために特殊なXMLタグを使用します。

#### 変数読み取り（Read Variable）

メモリに保存された値をプロンプトに注入する際に使用します。

```xml
<promptdata type="read-variable" subtype="taskMemory" identifier="変数キー">代替テキスト</promptdata>
```

#### 変数書き込み/アップデート（Update Variable）

LLMが抽出した情報を特定のメモリ変数に保存するよう指示する際に使用します。

```xml
<promptdata type="update-variable" subtype="taskMemory" identifier="変数キー">変数名</promptdata>
```

**例**：

> 「ユーザーに<promptdata type="read-variable" subtype="taskMemory" identifier="cafe24Orders">注文リスト</promptdata>を表示し、選択した注文番号を<promptdata type="update-variable" subtype="taskMemory" identifier="orderId">orderId</promptdata>に保存して。」

---

## 3. 制約事項および検証（Validation）

### 3.1 深刻度分類

| 深刻度 | 意味 | 説明 |
|--------|------|------|
| 🔴 | 保存不可 | Import/保存自体が失敗 |
| 🟠 | パブリッシュ不可 | 保存はできるがActive状態への切替不可 |
| 🟢 | 品質警告 | 保存/パブリッシュ可能だが推奨しない |

> Active状態のTaskはパブリッシュ基準が適用され🟠項目も保存不可

### 3.2 リソース制限（Per Channel）

| 項目 | 制限 | 深刻度 |
|------|------|--------|
| 全体Task数 | 最大100個 | 🔴 |
| Active Task数 | 最大50個 | 🔴 |
| フォルダ数 | 最大20個（root除外） | 🔴 |
| フォルダ深度 | 1段階 | 🔴 |

### 3.3 Taskレベル検証

| フィールド | 条件 | 深刻度 |
|------|------|--------|
| `name` | 0文字以下または50文字超過 | 🔴 |
| `trigger` | 0文字以下 | 🟠 |
| `trigger` | 5,000文字超過 | 🔴 |
| `nodes` | 0個 | 🟠 |
| `nodes` | 100個超過 | 🔴 |
| `startNodeId` | null | 🟠 |
| `startNodeId` | nodesにないID | 🟠 |
| サイクル | 脱出不可能な無限ループ（すべてのパスが循環） | 🔴 |
| 孤立ノード | startNodeIdから到達不可 | 🟢 |

> **サイクル判断基準**：条件付き脱出が可能な「リトライパターン」は許容されます。
> - ✅ 許容：A →（条件未充足）→ A,（条件充足）→ B → END

### 3.4 MemorySchema検証

| 条件 | 深刻度 |
|------|--------|
| key数50個超過 | 🔴 |
| key重複 | 🔴 |
| keyが0文字以下または60文字超過 | 🔴 |
| descriptionが500文字超過 | 🔴 |
| typeが無効 | 🔴 |

**有効なtype**：`boolean`、`number`、`string`、`list`、`listOfNumber`、`date`、`datetime`、`object`、`listOfObject`

### 3.5 Node共通検証

| フィールド | 条件 | 深刻度 |
|------|------|--------|
| `id` | 無効なフォーマット | 🔴 |
| `id` | Task内重複 | 🔴 |
| `key` | 無効なフォーマット | 🔴 |
| `key` | Task内重複 | 🔴 |
| `type` | 無効な値 | 🔴 |
| `name` | 0文字以下または50文字超過 | 🔴 |

**有効なtype**：`agent`、`message`、`code`、`userChatInlineAction`、`function`、`browserAutomation`

### 3.6 Next検証

#### goto
| 条件 | 深刻度 |
|------|--------|
| `to`が空 | 🟠 |
| `to`がnodesになく`END_TASK`でもない | 🟠 |
| `to`が自分自身 | 🔴 |

#### branch
| 条件 | 深刻度 |
|------|--------|
| `conditions[].filter`がExpressionスペックと不一致 | 🔴 |
| `conditions[].to`が空 | 🟠 |
| `conditions[].to`がnodesになく`END_TASK`でもない | 🟠 |
| `default`がnodesになく`END_TASK`でもない | 🟠 |

#### button
| 条件 | 深刻度 |
|------|--------|
| `buttons[].id` Task内重複 | 🔴 |
| `buttons[].name` 0文字以下 | 🟠 |
| `buttons[].name` 30文字超過 | 🔴 |
| `buttons[].to`がnodesになく`END_TASK`でもない | 🟠 |

### 3.7 ノードタイプ別検証

#### AgentNode
| 条件 | 深刻度 |
|------|--------|
| `instruction` 0文字以下 | 🟠 |
| `instruction` 10,000文字超過 | 🔴 |

#### MessageNode
| 条件 | 深刻度 |
|------|--------|
| `message` 空 | 🟠 |
| `message.blocks` 空 | 🟠 |

#### CodeNode / BrowserAutomationNode
| 条件 | 深刻度 |
|------|--------|
| `code` 0文字 | 🟠 |
| `code` 5,000文字超（実運用でエラー確認済み） | 🟡 |

#### UserChatInlineActionNode
| 条件 | 深刻度 |
|------|--------|
| `userChatState`がactions配列の最後でない | 🟠 |
| `userChatState: "opened"`後に他のノードが接続 | 🟠 |
| 各actionタイプ別必須値の欠如 | 🟠 |

#### FunctionNode
| 条件 | 深刻度 |
|------|--------|
| `functionKey` 空 | 🟠 |
| `inputMapping.type` 無効 | 🔴 |
| `inputMapping.sourceKey`のprefixが`user.`/`userChat.`/`taskMemory.`でない | 🔴 |
| `inputMapping`のsourceKey/valueが両方ないまたは両方ある | 🟠 |
| `outputMapping.type` 無効 | 🔴 |
| `outputMapping.targetKey`のprefixが`user.`/`userChat.`/`taskMemory.`でない | 🔴 |

### 3.8 TaskEditorPosition検証

| 条件 | 深刻度 |
|------|--------|
| `edgePositions` 欠如 | 🔴 |

#### nodePositions
| 条件 | 深刻度 |
|------|--------|
| idがnodesになく`TRIGGER`でもない | 🟠 |

#### edgePositions
| 条件 | 深刻度 |
|------|--------|
| `sourceNode.id`がnodesになく`TRIGGER`でもない | 🟠 |
| `sourceNode.type`が`goto`/`branch`/`button`でない（`onError`は使用禁止） | 🔴 |
| `sourceNode.offset`が0未満または100超過 | 🔴 |
| `targetNode.id`がnodesにない | 🔴 |
| `targetNode.offset`が0未満または100超過 | 🔴 |

### 3.9 ランタイム制限

- **Trace長**：ノード訪問最大100回（無限ループ防止）
- **Code Node実行時間**：最大60秒
- **Browser Node実行時間**：最大120秒

### 3.10 削除制約

- 稼働中（Active）のTaskは削除不可
- フォルダ内に稼働中のTaskがあればフォルダ削除不可

---

## 4. 実行およびエラー処理ポリシー

### 4.1 実行フロー

1. **順次実行**：開始ノードから定義された順序で実行します。
2. **遷移（Transition）**：
   - ブランチがない場合：デフォルトの次のノードへ移動。
   - ブランチがある場合：優先順位に従い条件を検査して移動。
   - 一致するブランチがない場合：デフォルトの次のノードへ移動。
3. **変更反映**：Taskが修正されるとリアルタイムで反映されますが、進行中のセッションでNode IDが変更されて見つからない場合、Taskは失敗処理されます。

### 4.2 失敗処理（Failure Handling）

進行中に**処理できない状態**になるとTaskは**別途通知なく即時終了（Fail）**されます。

- **コードノード**：コード実行中にエラー発生時。
- **メッセージノード**：メッセージ送信失敗時。
- **エージェントノード例外**：LLMサーバーエラー等はTask失敗ではなく、エージェントがユーザーとコミュニケーションして対応します。

---

## 5. エージェント連携（Interaction）

### 5.1 統合フロー

1. **分析**：LLMがユーザーメッセージを分析し`task_start`ツールを呼び出します。
2. **実行**：Task Executorが非同期でワークフローを実行します。
3. **委任（Agent Node）**：
   - Taskが`Agent Node`に到達すると実行を停止しLLMに制御権を渡します。
   - LLMはノードに定義されたInstructionに従ってユーザーに質問したり情報を収集します。
4. **再開**：
   - 必要な情報が収集されるとLLMは`task_finish_node`ツールを呼び出します。
   - Task Executorは再びワークフローを進行（Hook）します。

### 5.2 変数アップデート

- エージェントは対話中に`update_task_variable`ツールを使用してTaskメモリをアップデートできます。

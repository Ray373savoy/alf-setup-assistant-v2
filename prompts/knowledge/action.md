# Action Node（相談処理アクションノード）

相談タグ設定、相談員接続等の相談処理を実行するノードです。

## 重要：相談オープンは常に最後に

`userChatState: "opened"`は**actions配列の最後**に位置しなければなりません。
- 相談オープン後は他のアクションやノードを接続できない
- Taskセッションが終了するため

## FigJamに明示されたアクションのみ使用

FigJamにあるアクションのみ使用します。ないアクションは追加しません。

- FigJamに「チーム配分」あり → `teamAssign`使用（teamIdが分からなければ`""`）
- FigJamに「チーム配分」なし → `teamAssign`使用しない

## 主な使用パターン

1. **Task開始時**：相談タグ追加（Task追跡用）
2. **分岐の締めくくり**：相談オープン（相談員接続待機）
3. **特定条件時**：チーム/担当者配分

## onError発生時のエラー案内必須

コードノードでエラー発生（throw error）時、相談員接続前にメッセージノードでエラー案内が必要

```
コードノード（throw error）→ [onError] → メッセージノード（エラー案内）→ 相談処理アクション（相談員接続）
```

- メッセージ例は`message.md`参照

## アクションタイプ

### 相談オープン
```json
{
  "type": "userChatState",
  "state": "opened"
}
```

### 相談タグ
```json
// 相談タグ追加
{
  "type": "addUserChatTags",
  "tags": ["問い合わせ・確認/配送状況・配送履歴"]
}

// 相談タグ削除
{
  "type": "removeUserChatTags",
  "tags": ["処理中"]
}
```

---

### その他のアクションタイプ

**ID/値が分からなければ空文字列`""`で空欄にします。**（一切使わないのではない）

| type | 例 |
|------|------|
| `addUserTags` | `{ "tags": [...] }` |
| `removeUserTags` | `{ "tags": [...] }` または `{ "removeAll": true }` |
| `teamAssign` | `{ "teamId": "" }` |
| `teamUnassign` | `{}` |
| `managerAssign` | `{ "assigneeId": "" }` |
| `managerUnassign` | `{}` |
| `inviteFollowers` | `{ "followerIds": [] }` |
| `removeFollowers` | `{ "followerIds": [] }` または `{ "removeAll": true }` |
| `userChatPriority` | `{ "priority": "high" \| "medium" \| "low" }` |
| `userChatDescription` | `{ "description": "" }` |

## 複合アクション例

1つのノードで複数のアクションを同時に実行できます。

```json
{
  "id": "node-5",
  "key": "E",
  "name": "相談設定およびオープン",
  "type": "userChatInlineAction",
  "next": {
    "type": "goto",
    "to": "END_TASK"
  },
  "actions": [
    {
      "type": "addUserChatTags",
      "tags": ["Task/注文キャンセル"]
    },
    {
      "type": "userChatPriority",
      "priority": "high"
    },
    {
      "type": "teamAssign",
      "teamId": "637"
    },
    {
      "type": "userChatState",
      "state": "opened"
    }
  ]
}
```

> **順序注意**：`userChatState: "opened"`はactions配列の**最後**に位置しなければなりません。

## 相談処理アクションノードは常に分離

🔴 **相談処理アクション（相談員接続）は共有せず、各エラー分岐ごとに別途ノードとして生成する。**

- フロー終端点のため共有するとラインが絡まりやすい
- 同じ役割であっても各分岐ごとに別途ノードを生成
- 各アクションノードの前には **エラー理由を明示するメッセージノード** を必ず挟む

```
✅ 正しいパターン（各分岐に個別のメッセージ + アクション）：

[注文検索エラー]
  → msg-err1「注文の検索中にエラーが発生しました。相談員にお繋ぎいたします。」
    → action-err1（addUserChatTags:["エラー/注文検索"] → userChatState:"opened"）→ END_TASK

[ステータス変更不可]
  → msg-err2「現在の配送ステータスでは変更ができません。相談員にお繋ぎいたします。」
    → action-err2（addUserChatTags:["対応不可/配送ステータス"] → userChatState:"opened"）→ END_TASK

[キャンセル処理エラー]
  → msg-err3「キャンセル処理中にエラーが発生しました。相談員にお繋ぎいたします。」
    → action-err3（addUserChatTags:["エラー/キャンセル処理"] → userChatState:"opened"）→ END_TASK
```

**メッセージノードの要件：**
- 「エラーが発生しました」だけでなく、**どの処理段階で** 何が起きたかを明示する
- ステータス判定による対応不可は「エラー」ではなく「〜のため変更できません」と理由を伝える
- 相談員接続前の案内を省略しない

**アクションノードの要件：**
- 相談タグにエラー種別を含める（オペレーターが一目で状況を把握できるように）
- `userChatState: "opened"` は actions 配列の最後に配置する

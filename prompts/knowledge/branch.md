# Branch（分岐）

ノード実行後、条件に応じて異なるノードに移動する方法です。

## nextタイプ2種類

| タイプ | 説明 | 使用時点 |
|------|------|----------|
| `goto` | 無条件移動 | 次のノードが1つの場合 |
| `branch` | 条件付き分岐 | 条件に応じて異なるノードへ |

## goto（単純移動）

```json
{
  "next": {
    "type": "goto",
    "to": "node-2"
  }
}
```

Task終了時：
```json
{
  "next": {
    "type": "goto",
    "to": "END_TASK"
  }
}
```

## branch（条件付き分岐）

```json
{
  "next": {
    "type": "branch",
    "conditions": [
      {
        "filter": { /* 条件 */ },
        "to": "node-3"
      },
      {
        "filter": { /* 条件 */ },
        "to": "node-4"
      }
    ],
    "default": "node-5"
  }
}
```

- `conditions`：上から順番に評価、最初にtrueとなった条件へ移動
- `default`：すべての条件がfalseの場合に移動（必須）

## filter構造

🔴 **LeafノードをExpressionの直下に置くと `Invalid ExpressiveQuery format` エラーになる。必ず `and → or → Leaf` の構造で包むこと。**

```json
// ❌ 誤り（LeafをExpression直下に置いている）
{
  "filter": { "key": "taskMemory.x", "type": "string", "operator": "$eq", "values": ["v"] }
}

// ✅ 正しい（必ずand/orで包む）
{
  "filter": {
    "and": [
      {
        "or": [
          {
            "key": "変数パス",
            "type": "データタイプ",
            "operator": "演算子",
            "values": [比較値]
          }
        ]
      }
    ]
  }
}
```

- `and`：すべての条件がtrueでなければならない
- `or`：1つでもtrueであればよい
- ネスト可能：`and`の中に複数の`or`、各`or`の中に複数の条件
- `task.filter` にトリガー条件が不要な場合は `{ "and": [] }` を使用すること

## filterで使用可能なkey

### 1. メモリ（taskMemory）

```json
{ "key": "taskMemory.order_count", "type": "number", ... }
{ "key": "taskMemory.selected_order_id", "type": "string", ... }
{ "key": "taskMemory.has_customer_info", "type": "boolean", ... }
```

**taskMemory使用フロー**

branchで`taskMemory.xxx`を参照するには以下の順序で記述します：

```
1. memorySchemaに変数宣言
   ↓
2. 前のノード（コード/エージェント）で値を保存
   ↓
3. branch条件で参照
```

**例：hasCustomerInfo変数の使用**

```json
// Step 1: memorySchemaに宣言
"memorySchema": [
  { "key": "hasCustomerInfo", "type": "boolean", "description": "顧客情報存在有無" }
]

// Step 2: コードノードで保存
memory.put('hasCustomerInfo', true);
memory.save();

// Step 3: branchで参照
{ "key": "taskMemory.hasCustomerInfo", "type": "boolean", "operator": "$eq", "values": [true] }
```

### 2. 顧客情報（user）

**ビルトイン vs カスタムの区別**：`profile.`プレフィックスなしはビルトイン、ありはカスタム

```json
// ビルトインフィールド（profile.なし）
{ "key": "user.member", "type": "boolean", ... }
{ "key": "user.hasChat", "type": "boolean", ... }
{ "key": "user.tags", "type": "list", ... }

// カスタムフィールド（profile.あり）
{ "key": "user.profile.name", "type": "string", ... }
{ "key": "user.profile.mobileNumber", "type": "string", ... }
{ "key": "user.profile.customerId", "type": "string", ... }
```

### 3. 相談情報（userChat）

```json
// ビルトインフィールド
{ "key": "userChat.state", "type": "string", ... }
{ "key": "userChat.tags", "type": "list", ... }

// カスタムフィールド（profile.あり）
{ "key": "userChat.profile.deliveryNum", "type": "string", ... }
{ "key": "userChat.profile.orderNo", "type": "string", ... }
```

> **参考**：filterでは`context.`プレフィックスなしで`user.`、`userChat.`で開始

## type（データタイプ）

| type | 説明 |
|------|------|
| `string` | 文字列 |
| `number` | 数値 |
| `boolean` | true/false |
| `list` | 配列 |
| `date` | 日付 |

## operator（演算子）

### 基本演算子

| operator | 説明 | 例 |
|----------|------|------|
| `$eq` | 等しい | `{ "key": "taskMemory.status", "type": "string", "operator": "$eq", "values": ["完了"] }` |
| `$ne` | 異なる | `{ "operator": "$ne", "values": ["キャンセル"] }` |
| `$in` | 値が配列に含まれる | `{ "operator": "$in", "values": ["A", "B", "C"] }` |
| `$nin` | 値が配列に含まれない | `{ "operator": "$nin", "values": ["キャンセル", "返品"] }` |
| `$exist` | 値が存在する | `{ "operator": "$exist", "values": ["true"] }` |
| `$nexist` | 値が存在しない | `{ "operator": "$nexist", "values": ["true"] }` |

### 数値演算子（type: number）

| operator | 説明 | 例 |
|----------|------|------|
| `$gt` | より大きい（>） | `{ "key": "taskMemory.count", "type": "number", "operator": "$gt", "values": [0] }` |
| `$gte` | 以上（>=） | `{ "operator": "$gte", "values": [10] }` |
| `$lt` | 未満（<） | `{ "operator": "$lt", "values": [100] }` |
| `$lte` | 以下（<=） | `{ "operator": "$lte", "values": [50] }` |

### 文字列演算子（type: string）

| operator | 説明 | 例 |
|----------|------|------|
| `$startWith` | ～で始まる | `{ "key": "taskMemory.phone", "type": "string", "operator": "$startWith", "values": ["010"] }` |
| `$nStartWith` | ～で始まらない | `{ "operator": "$nStartWith", "values": ["02"] }` |

### リスト演算子（type: list）- ANY条件

1つでも満たせばtrue：

| operator | 説明 | 例 |
|----------|------|------|
| `$containsAny` | 1つでも含む | `{ "key": "user.tags", "type": "list", "operator": "$containsAny", "values": ["VIP", "Premium"] }` |
| `$anyStartWith` | 1つでも～で始まる | `{ "operator": "$anyStartWith", "values": ["order-"] }` |
| `$anyGte` | 1つでも以上 | `{ "operator": "$anyGte", "values": [100] }` |
| `$anyLte` | 1つでも以下 | `{ "operator": "$anyLte", "values": [10] }` |

### リスト演算子（type: list）- ALL条件

すべて満たさなければtrue：

| operator | 説明 | 例 |
|----------|------|------|
| `$containsAll` | すべて含む | `{ "key": "user.tags", "type": "list", "operator": "$containsAll", "values": ["会員", "認証完了"] }` |
| `$setEqual` | 集合が等しい | `{ "operator": "$setEqual", "values": ["A", "B"] }` |
| `$allStartWith` | すべて～で始まる | `{ "operator": "$allStartWith", "values": ["KR-"] }` |

## 実際の例

### 会員/非会員分岐

```json
{
  "next": {
    "type": "branch",
    "conditions": [
      {
        "filter": {
          "and": [{
            "or": [{
              "key": "user.member",
              "type": "boolean",
              "operator": "$eq",
              "values": [true]
            }]
          }]
        },
        "to": "node-3",
        "$index": "uuid-for-editor"
      }
    ],
    "default": "node-4"
  }
}
```
→ 会員ならnode-3、非会員ならnode-4
→ `$index`はエディター用の一意ID（UUID）

### データ件数分岐

```json
{
  "next": {
    "type": "branch",
    "conditions": [
      {
        "filter": {
          "and": [{
            "or": [{
              "key": "taskMemory.item_count",
              "type": "number",
              "operator": "$gt",
              "values": [0]
            }]
          }]
        },
        "to": "node-5"
      }
    ],
    "default": "node-6"
  }
}
```
→ データありならnode-5、なしならnode-6

### 複合条件（AND）

```json
{
  "filter": {
    "and": [
      {
        "or": [{
          "key": "context.user.member",
          "type": "boolean",
          "operator": "$eq",
          "values": [true]
        }]
      },
      {
        "or": [{
          "key": "taskMemory.order_count",
          "type": "number",
          "operator": "$gt",
          "values": [0]
        }]
      }
    ]
  }
}
```
→ 会員 **AND** データあり

### 複合条件（OR）

```json
{
  "filter": {
    "and": [{
      "or": [
        {
          "key": "taskMemory.status",
          "type": "string",
          "operator": "$eq",
          "values": ["{状態A}"]
        },
        {
          "key": "taskMemory.status",
          "type": "string",
          "operator": "$eq",
          "values": ["{状態B}"]
        }
      ]
    }]
  }
}
```
→ {状態A} **OR** {状態B}

## 分岐条件作成の原則

### 一般分岐：defaultを「else」として活用

大部分の分岐は一方の条件のみconditionsに、残りはdefaultで処理します。

```json
// 会員/非会員分岐
{
  "conditions": [
    { "filter": { /* member == true */ }, "to": "node-会員" }
  ],
  "default": "node-非会員"
}

// データ有無分岐
{
  "conditions": [
    { "filter": { /* count > 0 */ }, "to": "node-あり" }
  ],
  "default": "node-なし"
}
```

- conditions：明示的にチェックする条件
- default：残りのすべてのケース（else）

API呼び出しコードノードのエラー処理はbranchではなく`onError`フィールドを使用します。（`code.md`参照）

---

## 検証ルール

### 次のノードは別のノードを指さなければならない

`next.to`、`branch.conditions[].to`、`branch.default`は**自分自身ではない別のノード**または`"END_TASK"`を指さなければなりません。

**正しい例 - goto：**

```json
{
  "id": "node-3",
  "next": {
    "type": "goto",
    "to": "node-4"
  }
}
```

**正しい例 - branch：**

```json
{
  "id": "node-2",
  "next": {
    "type": "branch",
    "conditions": [
      {
        "filter": { ... },
        "to": "node-3"
      }
    ],
    "default": "node-4"
  }
}
```

**正しい例 - 終了：**

```json
{
  "id": "node-5",
  "next": {
    "type": "goto",
    "to": "END_TASK"
  }
}
```

### 目的地は存在するノードでなければならない

すべての分岐目的地は`nodes`配列に存在するidまたは`"END_TASK"`でなければなりません。

**正しいフロー例：**

```
nodes: [node-1, node-2, node-3, node-4]
startNodeId: "node-1"

node-1 → node-2（✅ 存在する）
node-2 → node-3 または node-4（✅ 存在する）
node-3 → END_TASK（✅ 終了）
node-4 → END_TASK（✅ 終了）
```

### すべてのノードは到達可能でなければならない

`startNodeId`から開始してすべての分岐を辿ったとき、すべてのノードに到達できなければなりません。

**正しい構造：**

```
startNodeId: "node-1"

node-1 → node-2 → node-3 → END_TASK
              ↘ node-4 → END_TASK

すべてのノード（node-1, 2, 3, 4）がstartNodeIdから到達可能 ✅
```

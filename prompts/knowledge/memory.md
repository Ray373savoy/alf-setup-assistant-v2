# Memory（メモリ）

1つのTask実行フローにおける**一時保存領域**です。

## 特徴

- **Task終了時に揮発**
- **次のノードへデータ伝達**：API結果や入力値を保存して後続ノードで使用

## Contextとの違い

| 区分 | Context | Memory |
|------|---------|--------|
| 時点 | 相談開始前に存在 | Task実行中に保存 |
| 性格 | 顧客/相談情報 | API結果、入力値 |
| 読み取り | `context.user.xxx` | `memory.get('key')` |
| 書き込み | テスト時に任意の値が可能 | `memory.put()` + `memory.save()` |

## 使用可能な場所

- コードノード
- エージェントノード
- ブランチ条件

## コードノードで

```javascript
// 読み取り
const customer_name = memory.get('customer_name');

// 書き込み（putを複数回、saveは最後に1回）
memory.put('customer_name', customer_name);
memory.put('order_count', order_count);
memory.save();
```

## エージェントノードで

**重要：identifierとcontentは必ず同一でなければなりません。**

```markdown
読み取り: <promptdata type="read-variable" subtype="taskMemory" identifier="key">key</promptdata>
書き込み: <promptdata type="update-variable" subtype="taskMemory" identifier="key">key</promptdata>
```

## ブランチ条件で

```json
{
  "key": "taskMemory.order_count",
  "type": "number",
  "operator": "$gt",
  "values": [0]
}
```

## memorySchema

Taskで使用するメモリ変数を事前に定義します。

```json
{
  "memorySchema": [
    {
      "key": "customer_name",
      "type": "string",
      "description": "顧客名"
    },
    {
      "key": "order_count",
      "type": "number",
      "description": "注文数"
    },
    {
      "key": "has_customer_info",
      "type": "boolean",
      "description": "顧客情報存在有無"
    }
  ]
}
```

### memorySchema宣言ルール

Taskで使用するすべてのメモリ変数はmemorySchemaに事前に定義します。

**memorySchemaに含める変数：**

1. コードノードで`memory.put('key', value)`で保存するキー
2. エージェントノードで`<promptdata type="update-variable">`で保存するキー
3. branch条件で`taskMemory.xxx`で参照するキー

**例：{業務} TaskのmemorySchema**

```json
"memorySchema": [
  { "key": "hasRequiredInfo", "type": "boolean", "description": "必須情報存在有無" },
  { "key": "isConfirmed", "type": "boolean", "description": "確認完了有無" },
  { "key": "currentStatus", "type": "string", "description": "現在の状態" }
]
```

上記の変数はコードノードで保存し、branchで参照できます：

```javascript
// コードノード
memory.put('hasRequiredInfo', true);
memory.put('isConfirmed', false);
memory.save();
```

### タイプ

- `string`：文字列
- `number`：数値
- `boolean`：true/false
- `list`：配列（例：order_list）

## 検証ルール

### 使用するkeyは必ずmemorySchemaに宣言

memoryを使用するすべてのkeyはmemorySchemaに事前に宣言されていなければなりません。

**🔴 未宣言のキーで memory.put() / memory.get() を実行するとランタイムエラーが発生し、タスクが停止する。** これは最も頻繁に発生するインポート後エラーの原因であり、特にコードノードのキー数が多い場合（Shopify/ロジレステンプレート使用時など）に漏れやすい。

**正しい例：**

```json
"memorySchema": [
  { "key": "customerName", "type": "string", "description": "顧客名" },
  { "key": "orderId", "type": "string", "description": "注文ID" },
  { "key": "hasInfo", "type": "boolean", "description": "情報存在有無" }
]
```

```javascript
// コードノード - memorySchemaに宣言されたkey使用 ✅
memory.put('customerName', name);
memory.put('orderId', id);
memory.put('hasInfo', true);
memory.save();
```

```markdown
// エージェントノード - memorySchemaに宣言されたkey使用 ✅
<promptdata type="update-variable" subtype="taskMemory" identifier="orderId">orderId</promptdata>
```

```json
// branch条件 - memorySchemaに宣言されたkey使用 ✅
{ "key": "taskMemory.hasInfo", "type": "boolean", "operator": "$eq", "values": [true] }
```

### 未使用は許容

memorySchemaに宣言したがまだ使用していないkeyは許容されます。（将来の拡張が可能）

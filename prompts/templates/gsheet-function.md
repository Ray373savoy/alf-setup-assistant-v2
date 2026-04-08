# Google Spreadsheet 関数ノード テンプレート

## 概要

タスクのワークフロー内で **Google Spreadsheet のデータを読み取り・編集** する必要がある場合に使用する。
Code Node ではなく **Function Node（関数ステップ）** として実装する。

### 前提条件

- Channel Talk のアプリストアで「Google Spreadsheet」アプリがインストール済みであること
- Google アカウントが連携済みであること
- 対象のスプレッドシートにアクセス権があること

---

## Function Node の基本構造

### functionKey の命名規則

```
app-{APP_ID}-mcp.tool.{関数名}
```

- `APP_ID`: チャネルごとに異なる固有ID → **プレースホルダー化必須**
- `関数名`: `get_row_by_key`, `append_row` 等（下記関数一覧参照）

### 🔴 プレースホルダー

| プレースホルダー | 説明 | 置き換え対象一覧に含める |
|---------------|------|---------------------|
| `GSHEET_APP_ID` | Google Spreadsheet アプリのID（チャネルごとに異なる） | ✅ 必須 |
| `SPREADSHEET_ID` | 対象スプレッドシートのID（URLの `/d/{ID}/` 部分） | ✅ 必須 |
| `SHEET_NAME` | 対象シート名（デフォルト: `Sheet1`） | ✅ 必須 |

`APP_ID` はChannel Talk の管理画面 → タスクエディタで関数ステップを追加した際に、functionKey の一部として自動設定される値。既存のタスクJSONから `functionKey` を確認して抽出すること。

### 共通フィールド

```json
{
  "type": "function",
  "functionType": "app",
  "functionKey": "app-GSHEET_APP_ID-mcp.tool.{関数名}",
  "appSystemVersion": "v1",
  "inputMappings": [ ... ],
  "outputMappings": [ ... ],
  "next": { "type": "goto", "to": "..." },
  "onError": { "type": "goto", "to": "..." }
}
```

### inputMappings の2パターン

```json
// パターン1: 固定値（value指定）— スプレッドシートID、シート名、カラム名など
{ "name": "spreadsheetId", "type": "string", "value": "SPREADSHEET_ID" }

// パターン2: memoryから取得（sourceKey指定）— 検索キー値、書き込み内容など
{ "name": "keyValue", "type": "string", "sourceKey": "taskMemory.shop_name" }
```

### outputMappings

```json
// 関数の実行結果をmemoryに保存
{ "propertyPath": "result", "type": "object", "targetKey": "taskMemory.result" }
```

⚠️ `outputMappings` の `targetKey` で指定するキーは **memorySchema に登録必須**。

---

## 関数一覧と inputMappings

### 読み取り系

#### get_row_by_key — キー値で行を検索

指定カラムでキー値と一致する最初の行を返却する。重複時は warning を含む。

```json
{
  "type": "function",
  "functionType": "app",
  "functionKey": "app-GSHEET_APP_ID-mcp.tool.get_row_by_key",
  "appSystemVersion": "v1",
  "inputMappings": [
    { "name": "keyColumn", "type": "string", "value": "A" },
    { "name": "keyValue", "type": "string", "sourceKey": "taskMemory.search_key" },
    { "name": "sheetName", "type": "string", "value": "SHEET_NAME" },
    { "name": "spreadsheetId", "type": "string", "value": "SPREADSHEET_ID" }
  ],
  "outputMappings": [
    { "propertyPath": "result", "type": "object", "targetKey": "taskMemory.gsheet_result" }
  ]
}
```

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `keyColumn` | string | ✅ | 検索対象のカラム（例: `"A"`, `"B"`） |
| `keyValue` | string | ✅ | 検索するキー値（memoryから取得） |
| `sheetName` | string | ✅ | シート名 |
| `spreadsheetId` | string | ✅ | スプレッドシートID |

**用途例:** 店舗名で検索してURL等の関連情報を取得、注文番号で検索してステータスを確認

---

#### get_rows_by_index — 行範囲で取得

指定された行範囲のデータを2次元配列で返却する。

```json
{
  "type": "function",
  "functionType": "app",
  "functionKey": "app-GSHEET_APP_ID-mcp.tool.get_rows_by_index",
  "appSystemVersion": "v1",
  "inputMappings": [
    { "name": "startRow", "type": "string", "value": "2" },
    { "name": "endRow", "type": "string", "value": "10" },
    { "name": "sheetName", "type": "string", "value": "SHEET_NAME" },
    { "name": "spreadsheetId", "type": "string", "value": "SPREADSHEET_ID" }
  ],
  "outputMappings": [
    { "propertyPath": "result", "type": "object", "targetKey": "taskMemory.gsheet_rows" }
  ]
}
```

---

#### get_row_count — 総行数を取得

シートのデータがある総行数を返却する（A:ZZ範囲基準）。

```json
{
  "type": "function",
  "functionType": "app",
  "functionKey": "app-GSHEET_APP_ID-mcp.tool.get_row_count",
  "appSystemVersion": "v1",
  "inputMappings": [
    { "name": "sheetName", "type": "string", "value": "SHEET_NAME" },
    { "name": "spreadsheetId", "type": "string", "value": "SPREADSHEET_ID" }
  ],
  "outputMappings": [
    { "propertyPath": "result", "type": "object", "targetKey": "taskMemory.gsheet_row_count" }
  ]
}
```

---

#### list_sheets — シート一覧取得

スプレッドシート内のすべてのシート情報を照会する。

```json
{
  "type": "function",
  "functionType": "app",
  "functionKey": "app-GSHEET_APP_ID-mcp.tool.list_sheets",
  "appSystemVersion": "v1",
  "inputMappings": [
    { "name": "spreadsheetId", "type": "string", "value": "SPREADSHEET_ID" }
  ],
  "outputMappings": [
    { "propertyPath": "result", "type": "object", "targetKey": "taskMemory.gsheet_sheets" }
  ]
}
```

---

#### list_spreadsheets — スプレッドシート一覧取得

Google Drive でアクセス可能なスプレッドシートリストを照会する。

```json
{
  "type": "function",
  "functionType": "app",
  "functionKey": "app-GSHEET_APP_ID-mcp.tool.list_spreadsheets",
  "appSystemVersion": "v1",
  "inputMappings": [],
  "outputMappings": [
    { "propertyPath": "result", "type": "object", "targetKey": "taskMemory.gsheet_spreadsheets" }
  ]
}
```

`folderId` を指定するとフォルダ内でフィルタリングできる:
```json
{ "name": "folderId", "type": "string", "value": "GOOGLE_DRIVE_FOLDER_ID" }
```

---

### 書き込み系

#### append_row — 行を末尾に追加

シート末尾に新しい行を追加する。追加された行の位置を返却する。

```json
{
  "type": "function",
  "functionType": "app",
  "functionKey": "app-GSHEET_APP_ID-mcp.tool.append_row",
  "appSystemVersion": "v1",
  "inputMappings": [
    { "name": "sheetName", "type": "string", "value": "SHEET_NAME" },
    { "name": "spreadsheetId", "type": "string", "value": "SPREADSHEET_ID" },
    { "name": "values", "type": "string", "sourceKey": "taskMemory.gsheet_write_content" }
  ],
  "outputMappings": []
}
```

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `values` | string | ✅ | 書き込む内容（memoryから取得。カンマ区切り等の形式はクライアント要件次第） |
| `sheetName` | string | ✅ | シート名 |
| `spreadsheetId` | string | ✅ | スプレッドシートID |

**用途例:** 問い合わせ内容のログ記録、注文情報の転記

---

#### update_row_by_index — 行番号で更新

指定された行を新しい値で上書きする。

```json
{
  "type": "function",
  "functionType": "app",
  "functionKey": "app-GSHEET_APP_ID-mcp.tool.update_row_by_index",
  "appSystemVersion": "v1",
  "inputMappings": [
    { "name": "rowIndex", "type": "string", "value": "5" },
    { "name": "values", "type": "string", "sourceKey": "taskMemory.gsheet_update_content" },
    { "name": "sheetName", "type": "string", "value": "SHEET_NAME" },
    { "name": "spreadsheetId", "type": "string", "value": "SPREADSHEET_ID" }
  ],
  "outputMappings": []
}
```

⚠️ `rowIndex` は通常 memoryから取得する（検索結果の行番号等）:
```json
{ "name": "rowIndex", "type": "string", "sourceKey": "taskMemory.gsheet_found_row" }
```

---

#### update_row_by_key — キー値で検索して更新

キー値で行を検索して最初にマッチした行を更新する。重複時は warning を含む。

```json
{
  "type": "function",
  "functionType": "app",
  "functionKey": "app-GSHEET_APP_ID-mcp.tool.update_row_by_key",
  "appSystemVersion": "v1",
  "inputMappings": [
    { "name": "keyColumn", "type": "string", "value": "A" },
    { "name": "keyValue", "type": "string", "sourceKey": "taskMemory.search_key" },
    { "name": "values", "type": "string", "sourceKey": "taskMemory.gsheet_update_content" },
    { "name": "sheetName", "type": "string", "value": "SHEET_NAME" },
    { "name": "spreadsheetId", "type": "string", "value": "SPREADSHEET_ID" }
  ],
  "outputMappings": []
}
```

---

### 削除系

#### delete_rows_by_index — 行範囲で削除

指定された行範囲を削除し、削除された行数を返却する。

```json
{
  "type": "function",
  "functionType": "app",
  "functionKey": "app-GSHEET_APP_ID-mcp.tool.delete_rows_by_index",
  "appSystemVersion": "v1",
  "inputMappings": [
    { "name": "startRow", "type": "string", "value": "5" },
    { "name": "endRow", "type": "string", "value": "5" },
    { "name": "sheetName", "type": "string", "value": "SHEET_NAME" },
    { "name": "spreadsheetId", "type": "string", "value": "SPREADSHEET_ID" }
  ],
  "outputMappings": [
    { "propertyPath": "result", "type": "object", "targetKey": "taskMemory.gsheet_delete_result" }
  ]
}
```

---

#### delete_row_by_key — キー値で検索して削除

キー値で行を検索して最初にマッチした行を削除する。重複時は warning を含む。

```json
{
  "type": "function",
  "functionType": "app",
  "functionKey": "app-GSHEET_APP_ID-mcp.tool.delete_row_by_key",
  "appSystemVersion": "v1",
  "inputMappings": [
    { "name": "keyColumn", "type": "string", "value": "A" },
    { "name": "keyValue", "type": "string", "sourceKey": "taskMemory.search_key" },
    { "name": "sheetName", "type": "string", "value": "SHEET_NAME" },
    { "name": "spreadsheetId", "type": "string", "value": "SPREADSHEET_ID" }
  ],
  "outputMappings": [
    { "propertyPath": "result", "type": "object", "targetKey": "taskMemory.gsheet_delete_result" }
  ]
}
```

---

## ユースケース別の関数選択ガイド

| ユースケース | 関数 | 典型的なフロー |
|-------------|------|--------------|
| 店舗名でURL等を検索 | `get_row_by_key` | agent(店舗名ヒアリング) → function(検索) → agent(結果案内) |
| 問い合わせ内容をログ記録 | `append_row` | agent(ヒアリング) → function(書き込み) → message(完了案内) |
| ステータスをスプレッドシートで管理 | `get_row_by_key` + `update_row_by_key` | function(検索) → code(判定) → function(更新) |
| 注文一覧を取得して案内 | `get_rows_by_index` | function(範囲取得) → agent(結果案内) |
| 対応完了後にスプレッドシートに転記 | `append_row` | 処理完了 → code(内容整形) → function(転記) |

---

## 設計ルール

### onError の設定

Function Node にも `onError` フィールドが使える。スプレッドシートへのアクセスに失敗した場合（権限エラー、シート不在等）のルーティングを必ず設定すること。

```json
"onError": { "type": "goto", "to": "error-handler-node-id" }
```

⚠️ `onError` はノード定義に記述するが、**edgePositions には含めない**（Channel Talk の仕様）。

### memorySchema 登録

- `outputMappings` の `targetKey` で `taskMemory.xxx` を指定する場合、`xxx` を memorySchema に登録必須
- `inputMappings` で `sourceKey: "taskMemory.xxx"` を使う場合も同様
- 書き込み内容を整形するための中間変数（`gsheet_write_content` 等）も memorySchema に登録

### API置き換え対象

タスク納品時に以下を置き換え対象一覧に含めること:

```
| ノードID | ノード名 | キー | 現在の値 | 置き換え先の説明 |
|---------|---------|------|---------|----------------|
| node-X  | スプレッドシート読み込み | GSHEET_APP_ID (functionKey内) | GSHEET_APP_ID | Channel Talk のアプリID |
| node-X  | スプレッドシート読み込み | spreadsheetId | SPREADSHEET_ID | Google SpreadsheetのID |
| node-X  | スプレッドシート読み込み | sheetName | SHEET_NAME | 対象シート名 |
```

### Code Node との使い分け

| 状況 | 使用するノード |
|------|-------------|
| スプレッドシートの単純な読み書き | **Function Node**（このテンプレート） |
| 読み取り結果を加工してから分岐判定 | Function Node（読み取り） → **Code Node**（加工・判定） |
| 外部API（Shopify等）とスプレッドシートの両方を使う | Code Node（API呼び出し） + Function Node（スプレッドシート操作） |
| スプレッドシートに書き込む内容を複数のmemory変数から組み立てる | **Code Node**（内容整形 → memoryに保存） → Function Node（書き込み） |

---

## 注意事項

- **アプリID（APP_ID）はチャネルごとに異なる**。既存タスクの functionKey から抽出するか、管理画面で確認すること
- **spreadsheetId はスプレッドシートのURLから取得**: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`
- **get_row_by_key / update_row_by_key / delete_row_by_key は重複に注意**。キー値が重複している場合、最初にマッチした行のみ対象となり、warning が返る
- **行番号（rowIndex, startRow, endRow）は string 型** で渡すこと（number 型ではない）
- **values パラメータの形式** はクライアントのスプレッドシート構造に依存。事前に確認すること
- **onError は必ず設定**。スプレッドシートへのアクセス権限が切れた場合等に対応するため

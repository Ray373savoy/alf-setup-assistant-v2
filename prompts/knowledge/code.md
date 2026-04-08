# Code Node（コードノード）

Node.jsを通じて外部APIリクエストを実行したりデータを処理するノードです。

## 特徴

- **Node.js環境**（特殊な環境）
- **最大実行時間**：60秒
- **固定IP**で動作
- **memory、context活用可能**

## いつ使う？

- API呼び出し（データ照会、状態確認等）
- contextからmemoryへデータ移行
- データ加工/整形

## コード構造

コードノードのコードはhandler関数のbodyに入ります：

```javascript
export const handler = async (memory, context) => {
  // コードノードのcodeフィールドの内容がここに入る
};
```

**コード作成方法：関数本体の内容のみ記述**

コードノードは既に`handler`関数内で実行されるため、内容だけそのまま記述します：

```javascript
// 正しい書き方 - 内容だけそのまま記述
const name = memory.get('name');
const email = context.user.profile.email;

memory.put('customer_name', name);
memory.save();
```

## context/memory照会パターン

memoryを先に確認、なければcontextからfallback：

```javascript
const customer_name = memory.get('customer_name') || context.user.profile.name;
const customer_email = memory.get('customer_email') || context.user.profile.email;
let phone_number = memory.get('phone_number') || context.user.profile.mobileNumber;
```

## 電話番号整形

```javascript
// +82 → 0 変換
if (phone_number) {
  if (phone_number.startsWith('+82')) {
    phone_number = '0' + phone_number.slice(3);
  }
}

// ハイフン除去（API要件に応じて）
const cleaned_phone = phone_number ? phone_number.replace(/-/g, '') : '';
```

## API仕様活用

**核心：responseフィールド → memory保存 → 分岐条件**

1. 提案書で分岐条件を確認（どのフィールドで分岐するか）
2. API responseから該当フィールドを抽出
3. memoryに保存 → branchノードで活用

**重要：使用するフィールドのみ保存**
- response全体を保存しない
- 分岐条件、案内メッセージに実際に使われるフィールドのみ選別
- 例：注文状態で分岐 → `order_status`のみ保存
- 例外：リストデータ（order_list等）はlist形式で保存 → agentノードで出力/選択用

## API呼び出しスケルトン（必須）

**API通信があるコードノードは必ず以下の構造に従う：**

**⚠️ 例外：Shopify/ロジレステンプレート使用時はテンプレートのコードパターンを優先すること。** テンプレートの固定コードは単一 try-catch（リトライなし）で設計されている。これはALF Code Nodeの60秒タイムアウトとの兼ね合いで、リトライ3回×タイムアウト20秒=60秒でタスク自体がタイムアウトするリスクを避けるためである。テンプレートを使わない独自のAPI呼び出しコードを書く場合にのみ、以下のリトライパターンを適用する。

```javascript
const axios = require('axios');
const MAX_RETRIES = 3;
let retryCount = 0;

while (retryCount < MAX_RETRIES) {
  try {
    const response = await axios.get('{{BASE_URL}}/{endpoint}', {
      headers: { 'Content-Type': 'application/json' }
    });

    // データ保存...
    memory.put('data', response.data);
    console.log('[node-X] 照会成功:', { /* 必要な情報 */ });
    break;
  } catch (error) {
    retryCount++;
    if (retryCount >= MAX_RETRIES) {
      console.error('[node-X] 最終失敗:', { error: error.message });
      throw error;  // → onErrorへルーティング
    }
  }
}

memory.save();
```

**必須要素：**
- `while (retryCount < MAX_RETRIES)` + `try-catch`で最大3回リトライ
- 成功時：データ保存 → `break`でループ脱出
- 失敗時：`retryCount++` → リトライ
- 最終失敗時（3回すべて失敗）：`throw error` → `onError`へルーティング
- `memory.save()`はwhileの外で最後に1回のみ呼び出し

**onError活用：**

コードノードで`throw error`発生時、`onError`フィールドに指定されたノードへ自動ルーティングされます：

```json
{
  "type": "code",
  "next": { "type": "goto", "to": "node-success" },
  "onError": { "type": "goto", "to": "node-error-handler" },
  "code": "..."
}
```

エラー発生時のフロー：
```
コードノード（throw error）→ [onError] → メッセージノード（エラー案内）→ 相談処理アクション（相談員接続）
```
- 顧客への案内なしに直接相談員接続は禁止
- メッセージノードでのエラー案内必須
- メッセージ例は`message.md`参照

## memory保存パターン

- `put`は複数回、`save`は最後に1回
- 条件付き保存可能
- `save()`は最後の行で1回呼び出し

```javascript
if (customer_name) memory.put('customer_name', customer_name);
if (phone_number) memory.put('phone_number', phone_number);
if (customer_email) memory.put('customer_email', customer_email);

memory.save();
```

### 🔴 最重要：memorySchema への登録必須

**コードノードで `memory.put('key', value)` または `memory.get('key')` を使用するすべてのキーは、Task JSON の `memorySchema` に事前定義されていなければならない。未登録のキーを使用するとランタイムエラーが発生する。**

```
❌ エラーになるパターン:
   - コードノードで memory.put('order_status', 'FOUND') を呼んでいるが
   - memorySchema に { "key": "order_status", ... } が存在しない

✅ 正しいパターン:
   - memorySchema: [{ "key": "order_status", "type": "string", "description": "注文検索結果" }]
   - コードノード: memory.put('order_status', 'FOUND')
```

**コードノード作成後のセルフチェック（省略禁止）：**
1. コード内のすべての `memory.put('xxx')` のキー名を列挙する
2. コード内のすべての `memory.get('xxx')` のキー名を列挙する
3. 1+2 の全キーが `memorySchema` に存在するか突合する
4. 不足があれば **memorySchema に追加する**（コードを変えるのではなく memorySchema を合わせる）

**テンプレート（Shopify/ロジレス）使用時も同様：**
テンプレートの memoryキー表に記載されたキーのうち、選択したモジュールで使用するキーは
すべて Task JSON の `memorySchema` に追加すること。

## 早期終了パターン

特定の条件でノード実行を早期に終了できます：

```javascript
const required_field = memory.get('required_field');

if (!required_field) {
  memory.put('has_error', true);
  memory.save();
  return;  // ここで終了
}

// 以降のロジック続行...
```

## console.logパターン

ノードID + 状況別メッセージ + オブジェクト：

```javascript
console.log('[node-4] 照会成功:', { customer_name, item_count });
console.log('[node-4] データなし:', { customer_name });
console.error('[node-4] 照会失敗:', { error: error.message });
```

## API responseケーシング

APIがsnake_caseで応答すればsnake_caseを維持：

```javascript
// API response: { order_id, order_status }
const { order_id, order_status } = response.data;
memory.put('order_id', order_id);
```

## 実際の例：顧客情報確認および保存

```javascript
const customer_name = memory.get('customer_name') || context.user.profile.name;
const customer_email = memory.get('customer_email') || context.user.profile.email;
let phone_number = memory.get('phone_number') || context.user.profile.mobileNumber;

// 電話番号整形
if (phone_number && phone_number.startsWith('+82')) {
  phone_number = '0' + phone_number.slice(3);
}

const has_all_info = !!(customer_name && phone_number);

memory.put('customer_name', customer_name || '');
memory.put('customer_email', customer_email || '');
memory.put('phone_number', phone_number || '');
memory.put('has_all_info', has_all_info);
memory.save();

console.log('[node-1]', { customer_name, phone_number, has_all_info });
```

# futureshop エンジン テンプレート

## 概要

カートシステムが **futureshop** だと判明した場合に使用する。
**コア（検索ロジック）は固定、取得フィールドはタスクの目的に応じて選択する。**

### 🔴 futureshop の特性

futureshop APIは **参照系は強いが、更新系は限定的** なAPI。

- ✅ 受注検索・詳細取得・発送ステータス更新・入金更新・会員情報検索/変更
- ❌ **注文キャンセルAPIなし** / **配送先住所変更APIなし**

キャンセルや住所変更が必要な場合は、ステータス確認後にオペレーター接続するフローになる。
他のWMS/OMS（ロジレス、コマースロボティクス等）と組み合わせて使うケースが多い。

---

## 認証とトークン管理

### 認証方式

OAuth2.0 **client_credentials** 方式。access_token の有効期限は **1時間**。
refresh_token は存在しないが、クライアントID＋シークレットで何度でも再発行可能。

### 🔴 トークン管理アーキテクチャ（GAS + Spreadsheet + 関数ノード）

access_token が1時間で失効するため、ALF Code Node にハードコードする方式は使えない。
以下の構成でトークンを永続管理する。

```
[GAS（定期実行）]
  ① client_id + client_secret で access_token を取得
  ② Google Spreadsheet の指定セルに access_token を書き込み
  ③ 30分〜50分ごとに定期実行（1時間の有効期限内にリフレッシュ）

[ALF タスク実行時]
  ④ 関数ノード（get_row_by_key）で Spreadsheet から最新の access_token を取得
  ⑤ outputMappings で taskMemory.fs_access_token に保存
  ⑥ Code Node で memory.get('fs_access_token') を使ってAPIを呼び出し
```

この構成により、GAS がトークンのリフレッシュを担当し、ALF は常に最新のトークンを参照するだけで済む。

### プレースホルダー

| プレースホルダー | 説明 | 管理場所 |
|---------------|------|---------|
| `FS_API_DOMAIN` | APIドメイン（店舗ごとに異なる） | Code Node |
| `FS_SHOP_KEY` | 店舗キー | Code Node |
| `FS_CLIENT_ID` | クライアントID | GAS |
| `FS_CLIENT_SECRET` | クライアントシークレット | GAS |
| `GSHEET_APP_ID` | Google Spreadsheet アプリID | 関数ノード（functionKey内） |
| `TOKEN_SPREADSHEET_ID` | トークン管理用スプレッドシートID | 関数ノード（inputMappings内） |

### GAS デプロイ URL の管理

GAS のデプロイURL は Channel Talk の **Secret変数** で管理することを推奨。
Code Node 内にハードコードせず、Secret変数経由で参照する。

⚠️ トークンのリフレッシュは **GAS のみが行う**。ALF Code Node からはリフレッシュしないこと（競合防止）。

---

## API基本仕様

| 項目 | 値 |
|------|-----|
| ベースURL | `https://{FS_API_DOMAIN}/admin-api/v1/` |
| 認証 | `Authorization: Bearer {access_token}` + `X-SHOP-KEY: {店舗キー}` |
| レスポンス形式 | JSON |
| レート制限 | 1リクエスト/秒（クライアントID単位） |
| IP制限 | **あり（固定IPが必要）** |

### 🔴 IPアドレス制限

futureshop は接続元として **固定IP** が必要。ALF Code Node から直接呼ぶ場合、Channel Talk のサーバーIPを futureshop 側に登録する必要がある。**タスク納品時にIP一覧をクライアントに共有すること。**

---

## 主要エンドポイント

### 受注関連

| 操作 | メソッド | エンドポイント | 備考 |
|------|---------|--------------|----|
| 受注検索 | GET | `/shipping` | 受注番号・日時・ステータスで最大100件 |
| 受注取得（詳細） | GET | `/orders/{orderNo}` | 1件。ポイント・クーポン・メモ含む |
| 発送ステータス更新 | POST | `/shipping/status` | 送り状番号・発送日を更新 |
| 入金ステータス更新 | POST | `/payment/status` | 入金日を更新 |
| ステータス変更（処理済） | POST | `/order/complete` | 処理状況を「処理済」に変更 |

### 会員関連

| 操作 | メソッド | エンドポイント | 備考 |
|------|---------|--------------|----|
| 会員検索 | GET | `/member` | 会員ID・日時で最大100件 |
| 会員登録 | POST | `/member` | |
| 会員変更 | PUT | `/member/{memberId}` | |
| 会員削除 | DELETE | `/member/{memberId}` | |

### 商品・在庫関連

| 操作 | メソッド | エンドポイント |
|------|---------|----|
| 商品検索 | GET | `/products` |
| 在庫検索 | GET | `/inventory` |
| 在庫更新 | POST | `/inventory` |

---

## ステータス体系

### 処理状況区分（status）

| 値 | 意味 | 備考 |
|----|------|------|
| `AWAITING_PAYMENT` | 通常処理 | |
| `CANCELLED` | 注文取消 | APIでのキャンセル不可（管理画面のみ） |
| `REFUNDED` | 返品 | |
| `AWAITING_SHIPMENT` | 未回収 | |
| `COMPLETED` | 処理済 | APIで変更可 |
| `ON_HOLD` | 保留 | |
| `PREORDER` | 予約 | |

### 発送ステータス

| 値 | 意味 |
|----|------|
| `notShipped` | 未発送 |
| `shipped` | 発送済 |

### 入金ステータス

| 値 | 意味 |
|----|------|
| `notReceived` | 未入金 |
| `received` | 入金済 |

---

## 前提ルール（コア部分・変更禁止）

### 注文番号の扱い
- 顧客入力の注文番号は memory の `input_order_number`
- `input_order_number` は **上書き禁止**
- futureshop の受注番号は `orderNo`（12桁の文字列）

### トークン取得フロー（関数ノード → Code Node の二段構成）

```
[関数ノード] get_row_by_key でSpreadsheetからトークン取得
  → outputMappings: taskMemory.fs_access_token に保存
  → onError: トークン取得失敗 → オペレーター接続

[Code Node] memory.get('fs_access_token') でAPIを呼び出し
```

### 検索フロー（省略禁止）
1. `GET /shipping?orderNo={入力値}` で受注番号検索
2. 0件 → NOT_FOUND / 1件 → FOUND / 複数 → MULTIPLE
3. FOUND時は詳細が必要なら `GET /orders/{orderNo}` で追加取得

### レスポンス判定
```javascript
// HTTP 200 で orderList 配列が返る
// 検索結果は orderList 配列内
const orderList = response?.data?.orderList || [];
```

---

## フィールドカタログ

### コアキー（必須・常に含める）

| memoryキー | 型 | 説明 |
|-----------|-----|------|
| `input_order_number` | string | 顧客入力（上書き禁止） |
| `retry_count` | number | 注文番号再確認回数（2回でオペレーター接続） |
| `fs_access_token` | string | 関数ノードでSpreadsheetから取得したトークン |
| `fs_search_status` | string | FOUND / MULTIPLE / NOT_FOUND / ERROR |
| `fs_order_no` | string | 受注番号 |
| `fs_candidates` | listOfObject | 候補リスト |
| `fs_errorMessage` | string | エラー詳細 |

### 受注情報フィールド

| memoryキー | 型 | レスポンスフィールド | 用途例 |
|-----------|-----|---------------------|--------|
| `fs_status` | string | `status` | 処理状況判定 |
| `fs_order_date` | string | `date` | 注文日案内 |
| `fs_grand_total` | number | `grandTotal` | 請求合計案内 |
| `fs_product_total` | number | `productTotal` | 商品合計案内 |
| `fs_postage` | number | `postage` | 送料案内 |
| `fs_payment_type` | string | `paymentType` | 決済方法案内 |
| `fs_is_member` | boolean | `isMember` | 会員判定 |
| `fs_cancel_date` | string | `cancelDate` | キャンセル日確認 |

### 購入者フィールド（buyerInfo）

| memoryキー | 型 | レスポンスフィールド | 用途例 |
|-----------|-----|---------------------|--------|
| `fs_buyer_name` | string | `buyerInfo.lastName` + `firstName` | 購入者名案内 |
| `fs_buyer_mail` | string | `buyerInfo.mail` | メール案内 |
| `fs_buyer_tel` | string | `buyerInfo.telNoMain` | 電話番号案内 |
| `fs_buyer_member_id` | string | `buyerInfo.memberId` | 会員ID |

### お届け先フィールド（shipmentList[0].addressInfo）

| memoryキー | 型 | レスポンスフィールド | 用途例 |
|-----------|-----|---------------------|--------|
| `fs_ship_name` | string | `addressInfo.lastName` + `firstName` | 送付先案内 |
| `fs_ship_zip` | string | `addressInfo.postalCode` | 住所確認 |
| `fs_ship_address` | object | `addressInfo.prefecture` + `address1〜3` | 住所確認 |
| `fs_ship_phone` | string | `addressInfo.phoneNo` | 電話番号案内 |

### 配送情報フィールド（shipmentList[0].shippingInfo）

| memoryキー | 型 | レスポンスフィールド | 用途例 |
|-----------|-----|---------------------|--------|
| `fs_invoice_no` | string | `shippingInfo.invoiceNo` | 追跡番号案内 |
| `fs_shipping_date` | string | `shippingInfo.shippingDate` | 発送日案内 |
| `fs_preferred_date` | string | `shippingInfo.preferredDeliveryDate` | お届け希望日案内 |
| `fs_preferred_time` | string | `shippingInfo.preferredDeliveryTime` | お届け希望時間案内 |

### ユースケース別の選択ガイド

| ユースケース | コア | 受注情報 | お届け先 | 配送情報 |
|-------------|------|---------|--------|---------|
| 注文状況確認 | ✅ | status, order_date, grand_total | buyer_name | - |
| 追跡番号案内 | ✅ | status | - | invoice_no, shipping_date |
| 配送状況確認 | ✅ | status | ship_name, ship_address | invoice_no, preferred_date |
| 会員情報確認 | ✅ | is_member | buyer_member_id, buyer_name, buyer_mail | - |
| キャンセル確認→オペレーター | ✅ | status, cancel_date | - | - |
| 住所変更→オペレーター | ✅ | status | ✅全部 | - |

---

## コードテンプレート

### タスクのノード構成（トークン取得 → 検索の二段構成）

```
[関数ノード] Spreadsheetからトークン取得（get_row_by_key）
  → next: [Code Node] 受注検索
  → onError: [message] トークン取得エラー → [action] オペレーター接続

[Code Node] 受注検索
  → branch (fs_search_status): ...
```

### 関数ノード（トークン取得）

```json
{
  "type": "function",
  "functionType": "app",
  "functionKey": "app-GSHEET_APP_ID-mcp.tool.get_row_by_key",
  "appSystemVersion": "v1",
  "inputMappings": [
    { "name": "keyColumn", "type": "string", "value": "A" },
    { "name": "keyValue", "type": "string", "value": "futureshop_token" },
    { "name": "sheetName", "type": "string", "value": "tokens" },
    { "name": "spreadsheetId", "type": "string", "value": "TOKEN_SPREADSHEET_ID" }
  ],
  "outputMappings": [
    { "propertyPath": "result", "type": "object", "targetKey": "taskMemory.fs_token_row" }
  ],
  "onError": { "type": "goto", "to": "token-error-node-id" }
}
```

⚠️ Spreadsheet のレイアウト例: A列=キー名、B列=access_token、C列=更新日時
⚠️ `fs_token_row` から access_token を取り出す処理は Code Node の冒頭で行う

### Code Node（受注検索）

```javascript
const axios = require('axios');
const startedAt = Date.now();

try {
  const API_DOMAIN = 'FS_API_DOMAIN';
  const SHOP_KEY = 'FS_SHOP_KEY';
  const BASE_URL = `https://${API_DOMAIN}/admin-api/v1`;

  // === トークン取得（関数ノードで保存済み） ===
  const tokenRow = memory.get('fs_token_row');
  const accessToken = tokenRow?.B || tokenRow?.access_token || null;
  if (!accessToken) {
    memory.put('fs_search_status', 'ERROR');
    memory.put('fs_errorMessage', 'アクセストークンが取得できませんでした');
    await memory.save();
    return { ok: false };
  }
  memory.put('fs_access_token', accessToken);

  const inputOrderNumber = memory.get('input_order_number');

  // === retry_count: NOT_FOUND リトライ管理 ===
  const currentRetry = parseInt(memory.get('retry_count') || '0');
  memory.put('retry_count', currentRetry + 1);

  // === initKeys: コア（必須） ===
  memory.put('fs_search_status', null);
  memory.put('fs_order_no', null);
  memory.put('fs_candidates', []);
  memory.put('fs_errorMessage', null);
  // === initKeys: 選択フィールド（選択したもののみ記述） ===
  // [選択時のみ] memory.put('fs_status', null);
  // [選択時のみ] memory.put('fs_order_date', null);
  // [選択時のみ] memory.put('fs_grand_total', null);
  // [選択時のみ] memory.put('fs_product_total', null);
  // [選択時のみ] memory.put('fs_postage', null);
  // [選択時のみ] memory.put('fs_payment_type', null);
  // [選択時のみ] memory.put('fs_is_member', null);
  // [選択時のみ] memory.put('fs_cancel_date', null);
  // [選択時のみ] memory.put('fs_buyer_name', null);
  // [選択時のみ] memory.put('fs_buyer_mail', null);
  // [選択時のみ] memory.put('fs_buyer_tel', null);
  // [選択時のみ] memory.put('fs_buyer_member_id', null);
  // [選択時のみ] memory.put('fs_ship_name', null);
  // [選択時のみ] memory.put('fs_ship_zip', null);
  // [選択時のみ] memory.put('fs_ship_address', null);
  // [選択時のみ] memory.put('fs_ship_phone', null);
  // [選択時のみ] memory.put('fs_invoice_no', null);
  // [選択時のみ] memory.put('fs_shipping_date', null);
  // [選択時のみ] memory.put('fs_preferred_date', null);
  // [選択時のみ] memory.put('fs_preferred_time', null);

  if (!inputOrderNumber || String(inputOrderNumber).trim().length === 0) {
    memory.put('fs_search_status', 'ERROR');
    memory.put('fs_errorMessage', '注文番号（input_order_number）が入力されていません');
    await memory.save();
    return { ok: false };
  }

  const orderNo = String(inputOrderNumber).trim();
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'X-SHOP-KEY': SHOP_KEY,
  };

  // === 検索ロジック（固定・変更禁止） ===
  console.log('[FS] Search:', orderNo);
  const response = await axios({
    url: `${BASE_URL}/shipping`,
    method: 'GET',
    headers,
    params: { orderNo },
    timeout: 20000,
    validateStatus: (s) => s < 500,
  });

  if (response.status === 401) {
    memory.put('fs_search_status', 'ERROR');
    memory.put('fs_errorMessage', 'アクセストークンが無効です。トークンの更新状況を確認してください。');
    await memory.save();
    return { ok: false };
  }

  const orderList = response?.data?.orderList || [];

  if (orderList.length === 0) {
    memory.put('fs_search_status', 'NOT_FOUND');
    memory.put('fs_candidates', []);
    await memory.save();
    return { ok: false };
  }

  if (orderList.length > 1) {
    memory.put('fs_search_status', 'MULTIPLE');
    memory.put('fs_candidates', orderList.map(o => ({ orderNo: o.orderNo })));
    await memory.save();
    return { ok: false };
  }

  const order = orderList[0];
  const shipment = order.shipmentList?.[0] || {};
  const addr = shipment.addressInfo || {};
  const ship = shipment.shippingInfo || {};

  // === FOUND: コア（必須） ===
  memory.put('fs_search_status', 'FOUND');
  memory.put('fs_order_no', order.orderNo || null);
  memory.put('fs_candidates', []);

  // === FOUND: 選択フィールド（選択したもののみ記述） ===

  // [選択時のみ] 受注情報フィールド
  // memory.put('fs_status', order.status || null);
  // memory.put('fs_order_date', order.date || null);
  // memory.put('fs_grand_total', order.grandTotal || null);
  // memory.put('fs_product_total', order.productTotal || null);
  // memory.put('fs_postage', order.postage || null);
  // memory.put('fs_payment_type', order.paymentType || null);
  // memory.put('fs_is_member', order.isMember || null);
  // memory.put('fs_cancel_date', order.cancelDate || null);

  // [選択時のみ] 購入者フィールド
  // const buyer = order.buyerInfo || {};
  // memory.put('fs_buyer_name', `${buyer.lastName || ''} ${buyer.firstName || ''}`.trim() || null);
  // memory.put('fs_buyer_mail', buyer.mail || null);
  // memory.put('fs_buyer_tel', buyer.telNoMain || null);
  // memory.put('fs_buyer_member_id', buyer.memberId || null);

  // [選択時のみ] お届け先フィールド
  // memory.put('fs_ship_name', `${addr.lastName || ''} ${addr.firstName || ''}`.trim() || null);
  // memory.put('fs_ship_zip', addr.postalCode || null);
  // memory.put('fs_ship_address', {
  //   prefecture: addr.prefecture || null,
  //   address1: addr.address1 || null,
  //   address2: addr.address2 || null,
  //   address3: addr.address3 || null,
  // });
  // memory.put('fs_ship_phone', addr.phoneNo || null);

  // [選択時のみ] 配送情報フィールド
  // memory.put('fs_invoice_no', ship.invoiceNo || null);
  // memory.put('fs_shipping_date', ship.shippingDate || null);
  // memory.put('fs_preferred_date', ship.preferredDeliveryDate || null);
  // memory.put('fs_preferred_time', ship.preferredDeliveryTime || null);

  await memory.save();
  console.log('[FS] FOUND:', order.orderNo, 'in', Date.now() - startedAt, 'ms');
  return { ok: true };

} catch (err) {
  const message = err?.message ? String(err.message) : 'Unknown error';
  console.log('[FS] ERROR:', message);
  memory.put('fs_search_status', 'ERROR');
  memory.put('fs_errorMessage', message);
  await memory.save();
  return { ok: false };
}
```

---

## 注意事項

- **キャンセルAPIなし**: `status === 'CANCELLED'` は管理画面からのみ変更可能。タスクではステータス確認 → オペレーター接続
- **住所変更APIなし**: タスクでは現在の住所を案内 → オペレーター接続
- **トークンは1時間で失効**: GAS + Spreadsheet + 関数ノードでの管理が必須
- **IPアドレス制限あり**: Channel Talk のサーバーIPを futureshop に登録する必要あり。タスク納品時にIP一覧を共有
- **レート制限**: 1秒に1回。連続呼び出しに注意
- **受注検索と受注取得は別API**: 検索は一覧（最大100件）、取得は1件の詳細。ポイント・クーポン・メモが必要な場合は取得APIも呼ぶ

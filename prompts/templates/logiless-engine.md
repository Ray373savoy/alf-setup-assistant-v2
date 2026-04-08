# ロジレス（LOGILESS）エンジン テンプレート

## 概要

配送管理システムが **ロジレス（LOGILESS）** だと判明した場合に使用する。
**コア（検索ロジック）は固定、取得フィールドはタスクの目的に応じて選択する。**

---

## 設計ルール

### コードノード構成の判断基準

| 条件 | 構成 |
|------|------|
| 受注伝票の検索＋取得＋判定が単純 | **1ノード完結** |
| 判定ロジックが複雑 / 出荷伝票も必要 / 追加API呼び出しあり | **二層構造**（Code Node A + Code Node B） |

判断に迷ったら **1ノード完結を優先**。

### フィールド選択の原則

**タスクの分岐・判定・案内に使わないフィールドは含めない。**
出荷伝票関連フィールドはタスクが出荷情報を必要とする場合のみ含める。

### memorySchema 登録ルール

🔴 コードノードで `memory.put()` / `memory.get()` するキーは **すべて** Task JSON の `memorySchema` に登録すること。選択したフィールドに対応するキーだけを登録する。

---

## API基本仕様

| 項目 | 値 |
|------|-----|
| ベースURL | `https://app2.logiless.com/api/v1/merchant/#{merchant_id}/` |
| 認証 | OAuth2.0 Bearer Token |
| Content-Type | `application/json` |
| レート制限 | 1秒1リクエスト推奨（超過時 HTTP 429） |
| TLS | 1.2以上必須 |

### 主要エンドポイント

| 操作 | メソッド | エンドポイント | limit上限 |
|------|---------|--------------|----|
| 受注伝票一覧 | GET | `/sales_orders` | 500 |
| 受注伝票詳細 | GET | `/sales_orders/#{id}` | - |
| 受注キャンセル | POST | `/sales_orders/#{id}/cancel` | - |
| 受注伝票更新（住所変更等） | PUT | `/sales_orders/#{id}` | - |
| 出荷伝票一覧 | GET | `/outbound_deliveries` | 100 |
| 出荷伝票詳細 | GET | `/outbound_deliveries/#{id}` | - |

### ステータス体系

**伝票ステータス（status）:**
`WaitingForConfirmation`（確認待ち）/ `WaitingForPayment`（入金待ち）/ `WaitingForAllocation`（引当待ち）/ `WaitingForShipment`（出荷待ち）/ `Shipped`（出荷済み）/ `Cancelled`（キャンセル）

**配送ステータス（delivery_status）:**
`OnHold`（保留・✅変更可）/ `WaitingForShipment`（出荷待ち・✅変更可）/ `Shipping`（出荷作業中・❌変更不可）/ `Shipped`（出荷済み・❌変更不可）/ `Cancelled`（キャンセル・❌変更不可）

**入金ステータス:** `NotPaid` / `Paid`
**承認ステータス:** `NotAuthorized` / `Authorizing` / `Authorized` / `AuthorizationFailure`

---

## 前提ルール（コア部分・変更禁止）

### 注文コードの扱い
- 顧客入力の注文コードは memory の `input_order_code`
- `input_order_code` は **上書き禁止**

### 検索フロー（省略禁止）
1. 受注伝票API で `code` パラメータによる検索（単一指定のみ）
2. レスポンス内で `order.code === 入力値` の完全一致を確認
3. 完全一致1件 → FOUND / 完全一致0件で候補1件 → FOUND / 複数 → MULTIPLE / 0件 → NOT_FOUND

### APIキーのプレースホルダー
- `MERCHANT_ID`: `XXXXXXXX`
- `ACCESS_TOKEN`: `XXXXXXXX`

---

## フィールドカタログ

以下からタスクに必要なフィールドのみを選択する。

### コアキー（必須・常に含める）

| memoryキー | 型 | 説明 |
|-----------|-----|------|
| `input_order_code` | string | 顧客入力（上書き禁止） |
| `retry_count` | number | 注文番号再確認回数（2回でオペレーター接続） |
| `logiless_search_status` | string | FOUND / MULTIPLE / NOT_FOUND / ERROR |
| `logiless_sales_order_id` | string | 受注伝票ID |
| `logiless_sales_order_code` | string | 受注伝票コード |
| `logiless_errorMessage` | string | エラー詳細 |

### 受注伝票フィールド

| memoryキー | 型 | レスポンスフィールド | 用途例 |
|-----------|-----|---------------------|--------|
| `logiless_document_status` | string | `status` | 伝票ステータス判定 |
| `logiless_delivery_status` | string | `delivery_status` | 変更可否判定 |
| `logiless_payment_status` | string | `incoming_payment_status` | 入金確認 |
| `logiless_authorization_status` | string | `authorization_status` | 承認状態確認 |
| `logiless_document_date` | string | `document_date` | 受注日（期限判定） |
| `logiless_waiting_for_confirmation` | string | `waiting_for_confirmation` | 確認待ち判定 |
| `logiless_buyer_name` | string | `buyer_name1` | 購入者案内 |
| `logiless_recipient_name` | string | `recipient_name1` | 届け先案内 |
| `logiless_recipient_address_summary` | object | `recipient_*` から構築 | 住所変更確認 |
| `logiless_delivery_method` | string | `delivery_method` | 配送方法案内 |
| `logiless_delivery_temperature` | string | `delivery_temperature_control` | 温度管理確認 |
| `logiless_subtotal` | string | `subtotal` | 金額案内 |
| `logiless_total_summary` | object | 金額関連フィールドから構築 | 合計金額の案内 |
| `logiless_payment_method` | string | `payment_method` | 支払方法案内 |
| `logiless_total_quantity` | string | `total_quantity` | 数量案内 |

### 出荷伝票フィールド（出荷情報が必要な場合のみ）

| memoryキー | 型 | 説明 | 用途例 |
|-----------|-----|------|--------|
| `logiless_outbound_delivery_id` | string | 出荷伝票ID | 出荷状態の確認 |
| `logiless_outbound_delivery_status` | string | 出荷伝票の配送ステータス | 配送状況案内 |
| `logiless_tracking_number` | string | 送り状番号 | 追跡番号案内 |

### 判定用フィールド（Code Node B 使用時のみ）

| memoryキー | 型 | 説明 |
|-----------|-----|------|
| `logiless_can_modify` | boolean | 変更可否判定結果 |

### ユースケース別の選択ガイド

| ユースケース | コア | 受注伝票 | 出荷伝票 | 判定 |
|-------------|------|---------|---------|------|
| キャンセル可否 | ✅ | document_status, delivery_status | - | can_modify |
| 配送先変更可否 | ✅ | delivery_status, recipient_address | - | can_modify |
| 追跡番号案内 | ✅ | - | ✅全部 | - |
| 注文内容確認 | ✅ | buyer_name, subtotal, total_summary, total_quantity | - | - |
| 注文状態の総合案内 | ✅ | document_status, delivery_status, payment_status | 出荷済みなら追跡番号 | - |

---

## コードテンプレート

以下のテンプレートを使い、**選択したフィールドのみ** initKeys と FOUND 保存処理に含める。
`// [選択時のみ]` が付いた行は、選択した場合のみコメントを外し、不要な行は**削除する**。

```javascript
const axios = require('axios');
const startedAt = Date.now();

try {
  const MERCHANT_ID = 'XXXXXXXX';
  const ACCESS_TOKEN = 'XXXXXXXX';
  const BASE_URL = `https://app2.logiless.com/api/v1/merchant/${MERCHANT_ID}`;

  const inputOrderCode = memory.get('input_order_code');

  // === retry_count: NOT_FOUND リトライ管理 ===
  const currentRetry = parseInt(memory.get('retry_count') || '0');
  memory.put('retry_count', currentRetry + 1);

  // === initKeys: コア（必須） ===
  memory.put('logiless_search_status', null);
  memory.put('logiless_sales_order_id', null);
  memory.put('logiless_sales_order_code', null);
  memory.put('logiless_errorMessage', null);
  // === initKeys: 選択フィールド（選択したもののみ記述） ===
  // [選択時のみ] memory.put('logiless_document_status', null);
  // [選択時のみ] memory.put('logiless_delivery_status', null);
  // [選択時のみ] memory.put('logiless_payment_status', null);
  // [選択時のみ] memory.put('logiless_authorization_status', null);
  // [選択時のみ] memory.put('logiless_document_date', null);
  // [選択時のみ] memory.put('logiless_waiting_for_confirmation', null);
  // [選択時のみ] memory.put('logiless_buyer_name', null);
  // [選択時のみ] memory.put('logiless_recipient_name', null);
  // [選択時のみ] memory.put('logiless_recipient_address_summary', null);
  // [選択時のみ] memory.put('logiless_delivery_method', null);
  // [選択時のみ] memory.put('logiless_delivery_temperature', null);
  // [選択時のみ] memory.put('logiless_subtotal', null);
  // [選択時のみ] memory.put('logiless_total_summary', null);
  // [選択時のみ] memory.put('logiless_payment_method', null);
  // [選択時のみ] memory.put('logiless_total_quantity', null);
  // [選択時のみ: 出荷伝票] memory.put('logiless_outbound_delivery_id', null);
  // [選択時のみ: 出荷伝票] memory.put('logiless_outbound_delivery_status', null);
  // [選択時のみ: 出荷伝票] memory.put('logiless_tracking_number', null);

  if (!inputOrderCode || String(inputOrderCode).trim().length === 0) {
    memory.put('logiless_search_status', 'ERROR');
    memory.put('logiless_errorMessage', '注文コード（input_order_code）が入力されていません');
    await memory.save();
    return { ok: false };
  }

  const code = String(inputOrderCode).trim();
  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // === 検索ロジック（固定・変更禁止） ===
  console.log('[Logiless] Search order code:', code);
  const searchResponse = await axios({
    url: `${BASE_URL}/sales_orders`,
    method: 'GET',
    headers,
    params: { code: code, limit: 5 },
    timeout: 20000,
  });

  const orders = searchResponse?.data?.data || [];

  if (orders.length === 0) {
    memory.put('logiless_search_status', 'NOT_FOUND');
    await memory.save();
    return { ok: false };
  }

  const exactMatches = orders.filter((o) => o.code === code);
  let selectedOrder = null;

  if (exactMatches.length === 1) {
    selectedOrder = exactMatches[0];
  } else if (exactMatches.length > 1) {
    memory.put('logiless_search_status', 'MULTIPLE');
    memory.put('logiless_errorMessage', `同一コードの受注伝票が複数（${exactMatches.length}件）`);
    await memory.save();
    return { ok: false };
  } else if (orders.length === 1) {
    selectedOrder = orders[0];
  } else {
    memory.put('logiless_search_status', 'MULTIPLE');
    memory.put('logiless_errorMessage', `候補が複数（${orders.length}件）。確定不可。`);
    await memory.save();
    return { ok: false };
  }

  // === FOUND: コア（必須） ===
  memory.put('logiless_search_status', 'FOUND');
  memory.put('logiless_sales_order_id', String(selectedOrder.id));
  memory.put('logiless_sales_order_code', selectedOrder.code || null);

  // === FOUND: 選択フィールド（選択したもののみ記述） ===

  // [選択時のみ] 受注伝票フィールド
  // memory.put('logiless_document_status', selectedOrder.status || null);
  // memory.put('logiless_delivery_status', selectedOrder.delivery_status || null);
  // memory.put('logiless_payment_status', selectedOrder.incoming_payment_status || null);
  // memory.put('logiless_authorization_status', selectedOrder.authorization_status || null);
  // memory.put('logiless_document_date', selectedOrder.document_date || null);
  // memory.put('logiless_waiting_for_confirmation', selectedOrder.waiting_for_confirmation || 0);
  // memory.put('logiless_buyer_name', selectedOrder.buyer_name1 || null);
  // memory.put('logiless_recipient_name', selectedOrder.recipient_name1 || null);
  // memory.put('logiless_recipient_address_summary', {
  //   postCode: selectedOrder.recipient_post_code || null,
  //   prefecture: selectedOrder.recipient_prefecture || null,
  //   address1: selectedOrder.recipient_address1 || null,
  //   address2: selectedOrder.recipient_address2 || null,
  //   address3: selectedOrder.recipient_address3 || null,
  //   country: selectedOrder.recipient_country || null,
  // });
  // memory.put('logiless_delivery_method', selectedOrder.delivery_method || null);
  // memory.put('logiless_delivery_temperature', selectedOrder.delivery_temperature_control || null);
  // memory.put('logiless_subtotal', selectedOrder.subtotal || null);
  // memory.put('logiless_total_summary', {
  //   subtotal: selectedOrder.subtotal || 0,
  //   deliveryFee: selectedOrder.delivery_fee || 0,
  //   discount: selectedOrder.discount || 0,
  //   taxTotal: selectedOrder.tax_total || 0,
  //   sundryFee: selectedOrder.sundry_fee || 0,
  //   usePoint: selectedOrder.use_point || 0,
  // });
  // memory.put('logiless_payment_method', selectedOrder.payment_method || null);
  // memory.put('logiless_total_quantity', selectedOrder.total_quantity || null);

  // [選択時のみ: 出荷伝票] 出荷伝票の取得
  // ⚠️ outbound_deliveries API には sales_order_id フィルタが存在しない
  // → object_code で検索（クライアントごとに命名規則を確認すること）
  // try {
  //   await new Promise(r => setTimeout(r, 1100)); // レート制限対策
  //   const outboundResponse = await axios({
  //     url: `${BASE_URL}/outbound_deliveries`,
  //     method: 'GET',
  //     headers,
  //     params: { object_code: code, limit: 5 },
  //     timeout: 20000,
  //   });
  //   const deliveries = outboundResponse?.data?.data || [];
  //   if (deliveries.length > 0) {
  //     const delivery = deliveries[0];
  //     memory.put('logiless_outbound_delivery_id', String(delivery.id));
  //     memory.put('logiless_outbound_delivery_status', delivery.delivery_status || null);
  //     memory.put('logiless_tracking_number', delivery.tracking_number || null);
  //   }
  // } catch (outboundErr) {
  //   console.log('[Logiless] Outbound fetch failed (non-fatal):', outboundErr?.message);
  // }

  await memory.save();
  console.log('[Logiless] FOUND:', selectedOrder.code, 'in', Date.now() - startedAt, 'ms');
  return { ok: true };

} catch (err) {
  const message = err?.message ? String(err.message) : 'Unknown error';
  const status = err?.response?.status;
  console.log('[Logiless] ERROR:', status, message);
  memory.put('logiless_search_status', 'ERROR');
  if (status === 429) {
    memory.put('logiless_errorMessage', 'レート制限に達しました。しばらく待ってから再試行してください。');
  } else if (status === 401) {
    memory.put('logiless_errorMessage', '認証に失敗しました。アクセストークンを確認してください。');
  } else {
    memory.put('logiless_errorMessage', message);
  }
  await memory.save();
  return { ok: false };
}
```

---

## 二層構造を使う場合

### Code Node B: 変更可否判定テンプレート

```javascript
const deliveryStatus = memory.get('logiless_delivery_status');
const documentStatus = memory.get('logiless_document_status');

const MODIFIABLE = ['OnHold', 'WaitingForShipment'];
const canModify = MODIFIABLE.includes(deliveryStatus) && documentStatus !== 'Cancelled';

memory.put('logiless_can_modify', canModify);

if (!canModify) {
  memory.put('logiless_errorMessage',
    documentStatus === 'Cancelled'
      ? 'この注文はすでにキャンセル済みです。'
      : `配送ステータス「${deliveryStatus}」のため変更できません。`
  );
}
await memory.save();
return { ok: canModify };
```

---

## 注意事項

- **レート制限**: 連続呼び出しは `setTimeout(r, 1100)` で間隔を空ける
- **単一指定**: 受注伝票の `id`, `code` は配列指定不可
- **複数指定**: 出荷伝票の `document_status`, `delivery_status` はカンマ区切りで複数指定可
- **limit上限**: 受注伝票=500、出荷伝票=100（異なるので注意）
- **Shipping ロック**: 出荷作業中以降は変更系API呼び出し禁止
- **出荷伝票の紐付け**: `sales_order_id` フィルタは存在しない。`object_code` で検索するが、命名規則はクライアントごとに異なる。導入時に要確認。

### 🔴 PUT /sales_orders のリクエストボディ形式

受注伝票を更新（配送先住所変更等）する際、リクエストボディには **`"sales_order": {}` ラッパーが必須**。
ラッパーなしで直接フィールドを送ると無視される。

```javascript
// ✅ 正しい形式（sales_order ラッパーあり）
const body = {
  sales_order: {
    recipient_post_code: "1234567",
    recipient_country: "JP",
    recipient_prefecture: "東京都",
    recipient_address1: "渋谷区",
    recipient_address2: "1-2-3",
    recipient_address3: "14"
  }
};

// ❌ 間違い（ラッパーなし → 更新されない）
const body = {
  recipient_post_code: "1234567",
  recipient_country: "JP",
  recipient_prefecture: "東京都",
  recipient_address1: "渋谷区",
  recipient_address2: "1-2-3",
  recipient_address3: "14"
};
```

**Code Node での住所変更実装例：**

```javascript
await axios({
  url: `${BASE_URL}/sales_orders/${memory.get('logiless_sales_order_id')}`,
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  data: {
    sales_order: {
      recipient_post_code: memory.get('new_post_code'),
      recipient_country: "JP",
      recipient_prefecture: memory.get('new_prefecture'),
      recipient_address1: memory.get('new_address1'),
      recipient_address2: memory.get('new_address2'),
      recipient_address3: memory.get('new_address3') || "",
    }
  },
  timeout: 20000,
});
```

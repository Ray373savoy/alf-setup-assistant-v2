# オープンロジ（OPENLOGI）エンジン テンプレート

## 概要

WMSが **オープンロジ（OPENLOGI）** だと判明した場合に使用する。
**コア（検索ロジック）は固定、取得フィールドはタスクの目的に応じて選択する。**

認証は **Bearer Token 方式**（有効期限なし）のため、トークン管理は不要。
ALF Code Node にアクセストークンをハードコードするだけで永続的に動作する。

---

## 設計ルール

### コードノード構成の判断基準

| 条件 | 構成 |
|------|------|
| 検索＋取得＋判定が単純 | **1ノード完結** |
| 判定が複雑 / ステータスによる操作分岐あり | **二層構造**（Code Node A + Code Node B） |

判断に迷ったら **1ノード完結を優先**。

### フィールド選択の原則

**タスクの分岐・判定・案内に使わないフィールドは含めない。**

### memorySchema 登録ルール

🔴 コードノードで `memory.put()` / `memory.get()` するキーは **すべて** Task JSON の `memorySchema` に登録すること。選択したフィールドに対応するキーのみ。

---

## API基本仕様

| 項目 | 値 |
|------|-----|
| ベースURL | `https://api.openlogi.com/api`（本番） |
| | `https://api-demo.openlogi.com/api`（デモ） |
| 認証 | `Authorization: Bearer {ACCESS_TOKEN}` |
| バージョン | `X-Api-Version: 1.5`（推奨） |
| Content-Type | `application/json` |
| レート制限 | 60リクエスト/分 |
| IP制限 | なし |

### 必須ヘッダー（全リクエスト共通）

```javascript
const headers = {
  'Authorization': `Bearer ${ACCESS_TOKEN}`,
  'X-Api-Version': '1.5',
  'Content-Type': 'application/json',
};
```

### APIキーのプレースホルダー
- `ACCESS_TOKEN`: `XXXXXXXX`（管理画面のAPI Token管理で発行）
- `ACCOUNT_ID`: `XXXXXXXX`（アカウントコード。identifier指定APIで必要）

---

## 主要エンドポイント

### 出荷依頼（shipments）

| 操作 | メソッド | エンドポイント | 備考 |
|------|---------|--------------|----|
| 出荷依頼一覧 | GET | `/shipments` | `id` パラメータで検索 |
| 出荷依頼取得 | GET | `/shipments/{id}` | 内部IDで取得 |
| 出荷依頼更新 | PUT | `/shipments/{id}` | 未取込み状態のみ |
| 出荷依頼削除 | DELETE | `/shipments/{id}` | 未取込み状態のみ |
| 修正リクエスト | POST | `/shipments/{id}/modify` | 作業中ステータス用 |
| キャンセルリクエスト | POST | `/shipments/{id}/cancel` | 作業中ステータス用 |
| identifier指定取得 | GET | `/shipments/{account_id}/{identifier}` | 外部識別子で検索 |
| identifier指定更新 | PUT | `/shipments/{account_id}/{identifier}` | 外部識別子で更新 |
| identifier指定修正リクエスト | POST | `/shipments/{account_id}/{identifier}/modify` | |
| identifier指定キャンセルリクエスト | POST | `/shipments/{account_id}/{identifier}/cancel` | |
| 出荷実績（直近） | GET | `/shipments/shipped` | |

### 商品・在庫

| 操作 | メソッド | エンドポイント |
|------|---------|----|
| 商品情報取得 | GET | `/items/{id}` |
| 商品一覧 | GET | `/items` |
| 在庫情報 | GET | `/items?stock=1` |

---

## ステータス体系

### 出荷依頼ステータス（status）— 文字列

| ステータス | 説明 | 直接操作 | リクエスト操作 |
|-----------|------|---------|-------------|
| `waiting` | 取込み待ち | ✅ PUT/DELETE可 | - |
| `allocating` | 引当中 | ✅ PUT/DELETE可 | - |
| `working` | 作業中 | ❌ | ✅ modify/cancel リクエスト |
| `shipped` | 出荷済み | ❌ | ❌ |
| `cancel_requested` | キャンセル依頼中 | ❌ | ❌ |
| `modify_requested` | 修正依頼中 | ❌ | ❌ |
| `cancelled` | キャンセル済み | ❌ | ❌ |
| `backorder` | 取り寄せ中 | ✅ PUT/DELETE可 | - |

### 🔴 キャンセル・変更の2段階構造

OpenLogi はステータスに応じて **操作APIが異なる**。タスク設計時にクライアントの業務フローに合わせて分岐を設計すること。

```
ステータス判定
  ├─ waiting / allocating / backorder（未取込み）
  │   → DELETE で即キャンセル / PUT で即住所変更
  │
  ├─ working（作業中）
  │   → POST /cancel でキャンセル「リクエスト」（即時ではなく依頼）
  │   → POST /modify で修正「リクエスト」（即時ではなく依頼）
  │
  └─ shipped / cancelled / cancel_requested / modify_requested
      → 操作不可 → オペレーター接続
```

⚠️ `modify` / `cancel` はリクエスト（依頼）であり、即時実行ではない。倉庫側で処理されるまでタイムラグがある点をユーザーに案内すること。

---

## 前提ルール（コア部分・変更禁止）

### 注文番号の扱い
- 顧客入力の注文番号は memory の `input_order_identifier`
- `input_order_identifier` は **上書き禁止**
- OpenLogi は `id`（内部ID）と `identifier`（外部識別子 = Shopify注文番号等）が分離
- 顧客が伝えるのは通常 `identifier`（Shopify連携時は注文番号）
- identifier 指定APIで検索し、内部 `id` を取得してキャンセル等に使う

### 検索フロー（省略禁止）
1. `GET /shipments/{account_id}/{identifier}` で identifier 指定検索
2. レスポンスの `shipments` 配列を確認
3. 1件 → FOUND / 複数 → MULTIPLE / 0件 → NOT_FOUND
4. FOUND時は `id`（内部ID）を保存（キャンセル・更新APIに必要）

### レスポンス判定
```javascript
// HTTP 200 で shipments 配列が返る
// 404 の場合はリソースなし
if (response.status === 200) {
  const shipments = response?.data?.shipments || [response?.data];
  // ...
} else if (response.status === 404) {
  // NOT_FOUND
}
```

---

## フィールドカタログ

以下からタスクに必要なフィールドのみを選択する。

### コアキー（必須・常に含める）

| memoryキー | 型 | 説明 |
|-----------|-----|------|
| `input_order_identifier` | string | 顧客入力（上書き禁止） |
| `retry_count` | number | 注文番号再確認回数（2回でオペレーター接続） |
| `openlogi_search_status` | string | FOUND / MULTIPLE / NOT_FOUND / ERROR |
| `openlogi_shipment_id` | string | 内部ID（キャンセル・更新に必要） |
| `openlogi_identifier` | string | 外部識別子（注文番号） |
| `openlogi_candidates` | listOfObject | 候補リスト |
| `openlogi_errorMessage` | string | エラー詳細 |

### 出荷依頼フィールド

| memoryキー | 型 | レスポンスフィールド | 用途例 |
|-----------|-----|---------------------|--------|
| `openlogi_status` | string | `status` | ステータス判定・操作分岐 |
| `openlogi_shipping_date` | string | `shipping_date` | 出荷日案内 |
| `openlogi_tracking_code` | string | `tracking_code` | 追跡番号案内 |
| `openlogi_delivery_service` | string | `delivery_service` | 配送会社案内 |
| `openlogi_delivery_note_type` | string | `delivery_note_type` | 明細書設定 |
| `openlogi_warehouse` | string | `warehouse` | 倉庫コード |

### 送付先フィールド（recipient）

| memoryキー | 型 | レスポンスフィールド | 用途例 |
|-----------|-----|---------------------|--------|
| `openlogi_recipient_name` | string | `recipient.name` | 送付先案内 |
| `openlogi_recipient_zip` | string | `recipient.postcode` | 住所変更確認 |
| `openlogi_recipient_address_summary` | object | `recipient.prefecture` + `address1` + `address2` | 住所変更確認 |
| `openlogi_recipient_phone` | string | `recipient.phone` | 電話番号案内 |

### 商品フィールド（items）

| memoryキー | 型 | レスポンスフィールド | 用途例 |
|-----------|-----|---------------------|--------|
| `openlogi_items_summary` | listOfObject | `items[]` | 商品一覧案内 |
| `openlogi_items_count` | number | `items.length` | 商品数案内 |

### ユースケース別の選択ガイド

| ユースケース | コア | 出荷依頼 | 送付先 | 商品 |
|-------------|------|---------|--------|------|
| キャンセル可否 | ✅ | status | - | - |
| 配送先変更 | ✅ | status | ✅全部 | - |
| 追跡番号案内 | ✅ | status, tracking_code, delivery_service | - | - |
| 注文内容確認 | ✅ | status, shipping_date | recipient_name | items_summary |
| 配送状況確認 | ✅ | status, shipping_date, tracking_code | - | - |

---

## コードテンプレート

`// [選択時のみ]` が付いた行は、選択した場合のみコメントを外し、不要な行は **削除する**。

```javascript
const axios = require('axios');
const startedAt = Date.now();

try {
  const BASE_URL = 'https://api.openlogi.com/api';
  const ACCESS_TOKEN = 'XXXXXXXX';
  const ACCOUNT_ID = 'XXXXXXXX';

  const inputIdentifier = memory.get('input_order_identifier');

  // === retry_count: NOT_FOUND リトライ管理 ===
  const currentRetry = parseInt(memory.get('retry_count') || '0');
  memory.put('retry_count', currentRetry + 1);

  // === initKeys: コア（必須） ===
  memory.put('openlogi_search_status', null);
  memory.put('openlogi_shipment_id', null);
  memory.put('openlogi_identifier', null);
  memory.put('openlogi_candidates', []);
  memory.put('openlogi_errorMessage', null);
  // === initKeys: 選択フィールド（選択したもののみ記述） ===
  // [選択時のみ] memory.put('openlogi_status', null);
  // [選択時のみ] memory.put('openlogi_shipping_date', null);
  // [選択時のみ] memory.put('openlogi_tracking_code', null);
  // [選択時のみ] memory.put('openlogi_delivery_service', null);
  // [選択時のみ] memory.put('openlogi_warehouse', null);
  // [選択時のみ] memory.put('openlogi_recipient_name', null);
  // [選択時のみ] memory.put('openlogi_recipient_zip', null);
  // [選択時のみ] memory.put('openlogi_recipient_address_summary', null);
  // [選択時のみ] memory.put('openlogi_recipient_phone', null);
  // [選択時のみ] memory.put('openlogi_items_summary', []);
  // [選択時のみ] memory.put('openlogi_items_count', 0);

  if (!inputIdentifier || String(inputIdentifier).trim().length === 0) {
    memory.put('openlogi_search_status', 'ERROR');
    memory.put('openlogi_errorMessage', '注文番号（input_order_identifier）が入力されていません');
    await memory.save();
    return { ok: false };
  }

  const identifier = String(inputIdentifier).trim();
  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'X-Api-Version': '1.5',
    'Content-Type': 'application/json',
  };

  // === 検索ロジック（固定・変更禁止） ===
  console.log('[OpenLogi] Search identifier:', identifier);

  let response;
  try {
    response = await axios({
      url: `${BASE_URL}/shipments/${ACCOUNT_ID}/${identifier}`,
      method: 'GET',
      headers,
      timeout: 20000,
      validateStatus: (s) => s < 500,
    });
  } catch (reqErr) {
    memory.put('openlogi_search_status', 'ERROR');
    memory.put('openlogi_errorMessage', reqErr?.message || 'Request failed');
    await memory.save();
    return { ok: false };
  }

  if (response.status === 404) {
    memory.put('openlogi_search_status', 'NOT_FOUND');
    memory.put('openlogi_candidates', []);
    await memory.save();
    return { ok: false };
  }

  if (response.status !== 200) {
    memory.put('openlogi_search_status', 'ERROR');
    memory.put('openlogi_errorMessage', response?.data?.error || `HTTP ${response.status}`);
    await memory.save();
    return { ok: false };
  }

  // レスポンス解析: 単一オブジェクトまたは shipments 配列
  const data = response.data;
  let shipments = [];
  if (data?.shipments && Array.isArray(data.shipments)) {
    shipments = data.shipments;
  } else if (data?.id) {
    shipments = [data];
  }

  if (shipments.length === 0) {
    memory.put('openlogi_search_status', 'NOT_FOUND');
    memory.put('openlogi_candidates', []);
    await memory.save();
    return { ok: false };
  }

  if (shipments.length > 1) {
    memory.put('openlogi_search_status', 'MULTIPLE');
    memory.put('openlogi_candidates', shipments.map(s => ({ id: s.id, identifier: s.identifier || identifier })));
    await memory.save();
    return { ok: false };
  }

  const shipment = shipments[0];

  // === FOUND: コア（必須） ===
  memory.put('openlogi_search_status', 'FOUND');
  memory.put('openlogi_shipment_id', shipment.id || null);
  memory.put('openlogi_identifier', shipment.identifier || identifier);
  memory.put('openlogi_candidates', []);

  // === FOUND: 選択フィールド（選択したもののみ記述） ===

  // [選択時のみ] 出荷依頼フィールド
  // memory.put('openlogi_status', shipment.status || null);
  // memory.put('openlogi_shipping_date', shipment.shipping_date || null);
  // memory.put('openlogi_tracking_code', shipment.tracking_code || null);
  // memory.put('openlogi_delivery_service', shipment.delivery_service || null);
  // memory.put('openlogi_warehouse', shipment.warehouse || null);

  // [選択時のみ] 送付先フィールド
  // const r = shipment.recipient || {};
  // memory.put('openlogi_recipient_name', r.name || null);
  // memory.put('openlogi_recipient_zip', r.postcode || null);
  // memory.put('openlogi_recipient_address_summary', {
  //   prefecture: r.prefecture || null,
  //   address1: r.address1 || null,
  //   address2: r.address2 || null,
  // });
  // memory.put('openlogi_recipient_phone', r.phone || null);

  // [選択時のみ] 商品フィールド
  // const items = shipment.items || [];
  // memory.put('openlogi_items_summary', items.map(i => ({
  //   code: i.code || null, name: i.name || null, quantity: i.quantity || 0,
  // })));
  // memory.put('openlogi_items_count', items.length);

  await memory.save();
  console.log('[OpenLogi] FOUND:', shipment.id, 'in', Date.now() - startedAt, 'ms');
  return { ok: true };

} catch (err) {
  const message = err?.message ? String(err.message) : 'Unknown error';
  console.log('[OpenLogi] ERROR:', message);
  memory.put('openlogi_search_status', 'ERROR');
  memory.put('openlogi_errorMessage', message);
  await memory.save();
  return { ok: false };
}
```

---

## キャンセル実行

ステータスに応じて2つのAPIを使い分ける。

```javascript
const shipmentId = memory.get('openlogi_shipment_id');
const status = memory.get('openlogi_status');

const DIRECT_CANCEL_STATUSES = ['waiting', 'allocating', 'backorder'];

if (DIRECT_CANCEL_STATUSES.includes(status)) {
  // 未取込み → DELETE で即キャンセル
  const response = await axios({
    url: `${BASE_URL}/shipments/${shipmentId}`,
    method: 'DELETE',
    headers,
    timeout: 20000,
  });
} else if (status === 'working') {
  // 作業中 → キャンセルリクエスト（依頼）
  const response = await axios({
    url: `${BASE_URL}/shipments/${shipmentId}/cancel`,
    method: 'POST',
    headers,
    timeout: 20000,
  });
  // ⚠️ 即時キャンセルではなく依頼。ユーザーに「倉庫に依頼しました」と案内すること。
} else {
  // shipped / cancelled 等 → 操作不可
  memory.put('openlogi_errorMessage', `ステータス「${status}」のためキャンセルできません`);
}
```

---

## 住所変更実行

キャンセルと同様、ステータスで分岐する。

```javascript
const shipmentId = memory.get('openlogi_shipment_id');
const status = memory.get('openlogi_status');

const DIRECT_MODIFY_STATUSES = ['waiting', 'allocating', 'backorder'];

const recipientData = {
  recipient: {
    name: memory.get('new_recipient_name'),
    postcode: memory.get('new_postcode'),
    prefecture: memory.get('new_prefecture'),
    address1: memory.get('new_address1'),
    address2: memory.get('new_address2') || '',
    phone: memory.get('new_phone') || '',
  }
};

if (DIRECT_MODIFY_STATUSES.includes(status)) {
  // 未取込み → PUT で即更新
  await axios({
    url: `${BASE_URL}/shipments/${shipmentId}`,
    method: 'PUT',
    headers,
    data: recipientData,
    timeout: 20000,
  });
} else if (status === 'working') {
  // 作業中 → 修正リクエスト（依頼）
  await axios({
    url: `${BASE_URL}/shipments/${shipmentId}/modify`,
    method: 'POST',
    headers,
    data: recipientData,
    timeout: 20000,
  });
  // ⚠️ 即時変更ではなく依頼。ユーザーに「倉庫に依頼しました」と案内すること。
}
```

---

## 注意事項

- **認証**: Bearer Token（有効期限なし、管理画面で発行）。OAuthトークン管理不要
- **バージョンヘッダー必須**: `X-Api-Version: 1.5` を全リクエストに含めること
- **レート制限**: 60リクエスト/分。レスポンスヘッダー `X-RateLimit-Remaining` で残り回数確認可能
- **2段階操作**: 未取込み（DELETE/PUT）と作業中（cancel/modify リクエスト）で使うAPIが異なる
- **modify/cancel は依頼**: 即時実行ではない。倉庫での処理にタイムラグがある。ユーザーへの案内文に「依頼しました」と表現すること
- **identifier**: Shopify連携の場合、Shopifyの注文番号が identifier に入る。検索は `GET /shipments/{account_id}/{identifier}` を使用
- **IP制限**: なし（コマースロボティクスと異なりIP許可設定は不要）
- **account_id**: identifier 指定APIで必要。クライアントの管理画面で確認

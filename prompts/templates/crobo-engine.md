# コマースロボティクス（COMMERCE ROBO）エンジン テンプレート

## 概要

WMSが **コマースロボティクス（COMMERCE ROBO）** だと判明した場合に使用する。
**コア（検索ロジック）は固定、取得フィールドはタスクの目的に応じて選択する。**

認証は **APIキー方式**（`X-API-KEY` ヘッダー）のため、ロジレスのようなOAuthトークン管理は不要。
ALF Code Node にAPIキーをハードコードするだけで永続的に動作する。

---

## 設計ルール

### コードノード構成の判断基準

| 条件 | 構成 |
|------|------|
| 検索＋取得＋判定が単純 | **1ノード完結** |
| 判定が複雑 / 追加API呼び出しあり | **二層構造**（Code Node A + Code Node B） |

判断に迷ったら **1ノード完結を優先**。

### フィールド選択の原則

**タスクの分岐・判定・案内に使わないフィールドは含めない。**

### memorySchema 登録ルール

🔴 コードノードで `memory.put()` / `memory.get()` するキーは **すべて** Task JSON の `memorySchema` に登録すること。選択したフィールドに対応するキーのみ。

### 🔴 IPアドレス制限

コマースロボティクスはIPアドレス制限機能がある。ALF Code Node からAPIを呼ぶ場合、**Channel Talk のサーバーIPを許可リストに追加する必要がある。**

タスク設計時に、クライアントに以下を共有すること：
- Channel Talk のサーバーIP一覧（タスク納品物に含める）
- コマースロボティクスの店舗設定画面 →「標準APIのIPアドレス制限」にIPを追加する手順

---

## API基本仕様

| 項目 | 値 |
|------|-----|
| ベースURL | `https://api.crobo.jp/v1/`（共用サーバーNo.1）|
| | `https://apiXYZ.crobo.jp/v1/`（専用サーバーNo.XYZ）|
| 認証 | `X-API-KEY` ヘッダーにアクセスキーを設定 |
| Content-Type | `application/json`（POST/PUT時） |
| レート制限 | 1リクエスト/秒、バースト60 |
| IP制限 | 店舗設定画面で設定可能 |

⚠️ ベースURLはクライアントごとにサーバー番号が異なる。クライアントのCommerceRobo管理画面URLで確認：
- `https://app.crobo.jp/...` → サーバーNo.1 → `https://api.crobo.jp/v1/`
- `https://appXYZ.crobo.jp/...` → サーバーNo.XYZ → `https://apiXYZ.crobo.jp/v1/`

### APIキーのプレースホルダー
- `XXXXXXXX`（アクセスキー）
- `https://api.crobo.jp/v1/`（ベースURL、クライアントごとに要確認）

---

## 主要エンドポイント

| 操作 | メソッド | エンドポイント | 備考 |
|------|---------|--------------|----|
| 出荷指示取得 | GET | `/order/{order_id}` | order_id（内部ID）で取得 |
| 出荷指示検索 | GET | `/order/search` | order_no（注文番号）で検索可 |
| 出荷指示登録 | POST | `/order/` | |
| 出荷指示更新 | PUT | `/order/` | data配列で送信、最大200件 |
| 出荷指示削除 | DELETE | `/order/{order_id}` | |
| 出荷指示キャンセル | GET | `/order_cancel/{order_id}` | ⚠️ GETメソッド |
| 出荷指示明細検索 | GET | `/order_detail/search` | |
| 商品マスタ取得 | GET | `/product/{product_id}` | |
| 商品マスタ検索 | GET | `/product/search` | |
| 在庫検索 | GET | `/stock/search` | |

### 検索演算子

検索パラメータにはカラム名の後ろに演算子を付けて条件指定する。

| 演算子 | 意味 | 例 |
|--------|------|-----|
| `-eq` | 完全一致 | `order_no-eq=TEST001` |
| `-like` | 部分一致 | `order_no-like=TEST` |
| `-in` | 含まれる（カンマ区切り、最大100件） | `status_id-in=50,80` |
| `-lt` / `-gt` | より小さい / より大きい | `order_date-gt=2024-01-01` |
| `-lte` / `-gte` | 以下 / 以上 | |
| `-not` | 否定 | `cancel_flag-not=1` |

---

## ステータス体系

### ステータスID（status_id）— 数値

| ID | ステータス名 | 備考 |
|----|-------------|------|
| 5 | 同梱済 | |
| 20 | 処理中 | |
| 30 | 要確認 | |
| 31 | 入金確認 | |
| 32 | 住所不備 | |
| 33 | 備考確認 | |
| 34 | 後払いデータ | |
| 40 | 入荷待ち | |
| 50 | 出荷待ち | |
| 55 | 引当前戻し後出荷待ち | |
| 60 | 在庫確保 | |
| 80 | 未引当 | |
| 90 | 出荷準備中/出荷作業中 | |
| 95 | 出荷準備中（梱包待ち） | |
| 100 | 出荷検品済 | |

⚠️ キャンセル・住所変更可能なステータス範囲は **クライアントの要件次第**。タスク設計時にクライアントに確認すること。
API側でも「更新不可のステータスです」エラーを返すが、ユーザー体験のために事前判定を推奨。

### 配送ステータスID（shipping_status_id）

| ID | ステータス名 |
|----|-------------|
| 1 | 配達完了 |
| 3 | 配達中 |
| 5 | 依頼受付 |
| 9 | 集荷 |
| 10 | 輸送中 |
| 12 | 返品 |
| 32 | キャンセル |

（主要なもののみ抜粋。全32種は API ドキュメント参照）

---

## 前提ルール（コア部分・変更禁止）

### 注文番号の扱い
- 顧客入力の注文番号は memory の `input_order_number`
- `input_order_number` は **上書き禁止**
- コマースロボティクスは `order_no`（注文番号）と `order_id`（内部ID）が分離している
- 顧客が伝えるのは通常 `order_no` → 検索で `order_id` を取得してキャンセル等に使う

### 検索フロー（省略禁止）
1. `order_no-eq={入力値}` で完全一致検索
2. 0件なら `order_no-like={入力値}` で部分一致検索（limit=5）
3. 1件 → FOUND / 複数 → MULTIPLE / 0件 → NOT_FOUND
4. FOUND時は `order_id` を保存（キャンセル・更新APIに必要）

### レスポンス判定
```javascript
// result === "OK" で成功判定（HTTP 200 でも result が "NG" の場合あり）
if (response?.data?.result !== 'OK') {
  // エラー処理
}
```

---

## フィールドカタログ

以下からタスクに必要なフィールドのみを選択する。

### コアキー（必須・常に含める）

| memoryキー | 型 | 説明 |
|-----------|-----|------|
| `input_order_number` | string | 顧客入力（上書き禁止） |
| `retry_count` | number | 注文番号再確認回数（2回でオペレーター接続） |
| `crobo_search_status` | string | FOUND / MULTIPLE / NOT_FOUND / ERROR |
| `crobo_order_id` | string | 内部ID（キャンセル・更新に必要） |
| `crobo_order_no` | string | 注文番号 |
| `crobo_order_candidates` | listOfObject | 候補リスト |
| `crobo_errorMessage` | string | エラー詳細 |

### 出荷指示フィールド

| memoryキー | 型 | レスポンスフィールド | 用途例 |
|-----------|-----|---------------------|--------|
| `crobo_status_id` | string | `status_id` | ステータス判定 |
| `crobo_shipping_status_id` | string | `shipping_status_id` | 配送状況確認 |
| `crobo_order_date` | string | `order_date` | 注文日（期限判定） |
| `crobo_shipping_date` | string | `shipping_date` | 出荷日 |
| `crobo_shipping_schedule` | string | `shipping_schedule` | 出荷予定日 |
| `crobo_tracking_code` | string | `tracking_code` | 追跡番号案内 |
| `crobo_cancel_flag` | string | `cancel_flag` | キャンセル済み判定 |
| `crobo_shipped_flag` | string | `shipped_flag` | 出荷済み判定 |

### 注文者フィールド

| memoryキー | 型 | レスポンスフィールド | 用途例 |
|-----------|-----|---------------------|--------|
| `crobo_orderer_name` | string | `orderer_name` | 注文者案内 |
| `crobo_orderer_email` | string | `orderer_email` | メール通知 |
| `crobo_orderer_tel` | string | `orderer_tel` | 電話番号案内 |

### 送付先フィールド

| memoryキー | 型 | レスポンスフィールド | 用途例 |
|-----------|-----|---------------------|--------|
| `crobo_shipping_name` | string | `shipping_name` | 送付先案内 |
| `crobo_shipping_zip` | string | `shipping_zip` | 住所変更確認 |
| `crobo_shipping_address_summary` | object | `shipping_address1〜3` | 住所変更確認 |
| `crobo_shipping_tel` | string | `shipping_tel` | 電話番号案内 |

### 金額フィールド

| memoryキー | 型 | レスポンスフィールド | 用途例 |
|-----------|-----|---------------------|--------|
| `crobo_pay_total` | string | `pay_total` | 請求金額案内 |
| `crobo_product_total` | string | `product_total` | 商品金額案内 |
| `crobo_shipping_free` | string | `shipping_free` | 送料案内 |

### ユースケース別の選択ガイド

| ユースケース | コア | 出荷指示 | 送付先 | 金額 |
|-------------|------|---------|--------|------|
| キャンセル可否 | ✅ | status_id, cancel_flag | - | - |
| 配送先変更可否 | ✅ | status_id, cancel_flag | ✅全部 | - |
| 追跡番号案内 | ✅ | tracking_code, shipping_status_id | - | - |
| 注文内容確認 | ✅ | status_id, order_date | 注文者名 | pay_total, product_total |
| 配送状況確認 | ✅ | status_id, shipping_status_id, shipping_schedule | - | - |

---

## コードテンプレート

`// [選択時のみ]` が付いた行は、選択した場合のみコメントを外し、不要な行は **削除する**。

```javascript
const axios = require('axios');
const startedAt = Date.now();

try {
  const BASE_URL = 'https://api.crobo.jp/v1';  // クライアントごとに要確認
  const API_KEY = 'XXXXXXXX';

  const inputOrderNumber = memory.get('input_order_number');

  // === retry_count: NOT_FOUND リトライ管理 ===
  const currentRetry = parseInt(memory.get('retry_count') || '0');
  memory.put('retry_count', currentRetry + 1);

  // === initKeys: コア（必須） ===
  memory.put('crobo_search_status', null);
  memory.put('crobo_order_id', null);
  memory.put('crobo_order_no', null);
  memory.put('crobo_order_candidates', []);
  memory.put('crobo_errorMessage', null);
  // === initKeys: 選択フィールド（選択したもののみ記述） ===
  // [選択時のみ] memory.put('crobo_status_id', null);
  // [選択時のみ] memory.put('crobo_shipping_status_id', null);
  // [選択時のみ] memory.put('crobo_order_date', null);
  // [選択時のみ] memory.put('crobo_shipping_date', null);
  // [選択時のみ] memory.put('crobo_shipping_schedule', null);
  // [選択時のみ] memory.put('crobo_tracking_code', null);
  // [選択時のみ] memory.put('crobo_cancel_flag', null);
  // [選択時のみ] memory.put('crobo_shipped_flag', null);
  // [選択時のみ] memory.put('crobo_orderer_name', null);
  // [選択時のみ] memory.put('crobo_orderer_email', null);
  // [選択時のみ] memory.put('crobo_orderer_tel', null);
  // [選択時のみ] memory.put('crobo_shipping_name', null);
  // [選択時のみ] memory.put('crobo_shipping_zip', null);
  // [選択時のみ] memory.put('crobo_shipping_address_summary', null);
  // [選択時のみ] memory.put('crobo_shipping_tel', null);
  // [選択時のみ] memory.put('crobo_pay_total', null);
  // [選択時のみ] memory.put('crobo_product_total', null);
  // [選択時のみ] memory.put('crobo_shipping_free', null);

  if (!inputOrderNumber || String(inputOrderNumber).trim().length === 0) {
    memory.put('crobo_search_status', 'ERROR');
    memory.put('crobo_errorMessage', '注文番号（input_order_number）が入力されていません');
    await memory.save();
    return { ok: false };
  }

  const orderNo = String(inputOrderNumber).trim();
  const headers = { 'X-API-KEY': API_KEY };

  // === 検索ロジック（固定・変更禁止） ===
  const search = async (params) => {
    const response = await axios({
      url: `${BASE_URL}/order/search`,
      method: 'GET',
      headers,
      params: { ...params, limit: 5 },
      timeout: 20000,
    });
    if (response?.data?.result !== 'OK') return [];
    const data = response?.data?.data;
    if (!data) return [];
    return Array.isArray(data) ? data : [data];
  };

  // 完全一致検索
  console.log('[CRobo] Search exact:', orderNo);
  let orders = await search({ 'order_no-eq': orderNo });

  // 完全一致0件 → 部分一致検索
  if (orders.length === 0) {
    console.log('[CRobo] Search like:', orderNo);
    orders = await search({ 'order_no-like': orderNo });
  }

  if (orders.length === 0) {
    memory.put('crobo_search_status', 'NOT_FOUND');
    memory.put('crobo_order_candidates', []);
    await memory.save();
    return { ok: false };
  }

  // 完全一致で絞り込み
  const exactMatches = orders.filter(o => o.order_no === orderNo);
  let selectedOrder = null;

  if (exactMatches.length === 1) {
    selectedOrder = exactMatches[0];
  } else if (exactMatches.length > 1) {
    memory.put('crobo_search_status', 'MULTIPLE');
    memory.put('crobo_order_candidates', exactMatches.map(o => ({ order_id: o.order_id, order_no: o.order_no })));
    await memory.save();
    return { ok: false };
  } else if (orders.length === 1) {
    selectedOrder = orders[0];
  } else {
    memory.put('crobo_search_status', 'MULTIPLE');
    memory.put('crobo_order_candidates', orders.map(o => ({ order_id: o.order_id, order_no: o.order_no })));
    await memory.save();
    return { ok: false };
  }

  // === FOUND: コア（必須） ===
  memory.put('crobo_search_status', 'FOUND');
  memory.put('crobo_order_id', String(selectedOrder.order_id));
  memory.put('crobo_order_no', selectedOrder.order_no || null);
  memory.put('crobo_order_candidates', []);

  // === FOUND: 選択フィールド（選択したもののみ記述） ===

  // [選択時のみ] 出荷指示フィールド
  // memory.put('crobo_status_id', selectedOrder.status_id || null);
  // memory.put('crobo_shipping_status_id', selectedOrder.shipping_status_id || null);
  // memory.put('crobo_order_date', selectedOrder.order_date || null);
  // memory.put('crobo_shipping_date', selectedOrder.shipping_date || null);
  // memory.put('crobo_shipping_schedule', selectedOrder.shipping_schedule || null);
  // memory.put('crobo_tracking_code', selectedOrder.tracking_code || null);
  // memory.put('crobo_cancel_flag', selectedOrder.cancel_flag || null);
  // memory.put('crobo_shipped_flag', selectedOrder.shipped_flag || null);

  // [選択時のみ] 注文者フィールド
  // memory.put('crobo_orderer_name', selectedOrder.orderer_name || null);
  // memory.put('crobo_orderer_email', selectedOrder.orderer_email || null);
  // memory.put('crobo_orderer_tel', selectedOrder.orderer_tel || null);

  // [選択時のみ] 送付先フィールド
  // memory.put('crobo_shipping_name', selectedOrder.shipping_name || null);
  // memory.put('crobo_shipping_zip', selectedOrder.shipping_zip || null);
  // memory.put('crobo_shipping_address_summary', {
  //   address1: selectedOrder.shipping_address1 || null,
  //   address2: selectedOrder.shipping_address2 || null,
  //   address3: selectedOrder.shipping_address3 || null,
  // });
  // memory.put('crobo_shipping_tel', selectedOrder.shipping_tel || null);

  // [選択時のみ] 金額フィールド
  // memory.put('crobo_pay_total', selectedOrder.pay_total || null);
  // memory.put('crobo_product_total', selectedOrder.product_total || null);
  // memory.put('crobo_shipping_free', selectedOrder.shipping_free || null);

  await memory.save();
  console.log('[CRobo] FOUND:', selectedOrder.order_no, 'in', Date.now() - startedAt, 'ms');
  return { ok: true };

} catch (err) {
  const message = err?.message ? String(err.message) : 'Unknown error';
  const status = err?.response?.status;
  console.log('[CRobo] ERROR:', status, message);
  memory.put('crobo_search_status', 'ERROR');
  if (status === 401) {
    memory.put('crobo_errorMessage', '認証エラー。APIキーまたはIPアドレス制限を確認してください。');
  } else if (status === 429) {
    memory.put('crobo_errorMessage', 'レート制限に達しました。しばらく待ってから再試行してください。');
  } else {
    memory.put('crobo_errorMessage', message);
  }
  await memory.save();
  return { ok: false };
}
```

---

## キャンセル実行

キャンセルは **GETメソッド**（⚠️ POST ではない）で `order_id` を指定する。

```javascript
// キャンセル実行（Code Node B または1ノード完結の後半部分）
const orderId = memory.get('crobo_order_id');
const response = await axios({
  url: `${BASE_URL}/order_cancel/${orderId}`,
  method: 'GET',
  headers: { 'X-API-KEY': API_KEY },
  timeout: 20000,
});
if (response?.data?.result !== 'OK') {
  memory.put('crobo_errorMessage', (response?.data?.error || []).join(', '));
}
```

---

## 住所変更実行

住所変更は **PUTメソッド** で `data` 配列にラップして送信する。

```javascript
// 住所変更実行
const orderId = memory.get('crobo_order_id');
const response = await axios({
  url: `${BASE_URL}/order/`,
  method: 'PUT',
  headers: {
    'X-API-KEY': API_KEY,
    'Content-Type': 'application/json',
  },
  data: {
    data: [{
      order_id: parseInt(orderId),
      shipping_name: memory.get('new_shipping_name'),
      shipping_zip: memory.get('new_shipping_zip'),
      shipping_address1: memory.get('new_shipping_address1'),
      shipping_address2: memory.get('new_shipping_address2'),
      shipping_address3: memory.get('new_shipping_address3') || '',
      shipping_tel: memory.get('new_shipping_tel') || '',
    }]
  },
  timeout: 20000,
});
```

⚠️ `order_id` は `parseInt()` で数値型に変換すること（APIが int を要求）。

---

## 注意事項

- **認証**: APIキー方式（`X-API-KEY` ヘッダー）。OAuthトークン管理不要
- **レート制限**: 1リクエスト/秒。連続呼び出し時は `setTimeout(r, 1100)` で間隔を空ける
- **IP制限**: 店舗設定画面で設定可能。Channel Talk サーバーIPの許可が必要
- **キャンセルはGET**: `GET /order_cancel/{order_id}`（POST ではない）
- **更新は data 配列**: `PUT /order/` のリクエストボディは `{ data: [{ order_id, ... }] }` 形式
- **ステータスは数値ID**: ロジレスの文字列ステータスとは異なり、数値で判定する
- **検索上限**: limit のデフォルト20、最大200。offset でページネーション可能
- **ベースURL**: クライアントのサーバー番号で変動する。必ず確認すること

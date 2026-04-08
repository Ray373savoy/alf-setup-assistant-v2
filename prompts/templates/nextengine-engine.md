# ネクストエンジン（Next Engine）エンジン テンプレート

## 概要

EC一元管理システムが **ネクストエンジン（Next Engine）** だと判明した場合に使用する。
**コア（検索ロジック）は固定、取得フィールドはタスクの目的に応じて選択する。**

### 🔴 トークン管理の制約

認証は **access_token（1日）+ refresh_token（3日）** のOAuth2方式。
ロジレスと同様に ALF Code Node 単体では永続管理ができない。

ただし、ネクストエンジンはAPIレスポンスに**新しいトークンが自動で含まれる**仕組みを持つ。access_token が切れていても refresh_token が有効であれば正常にレスポンスが返り、新しいトークンペアがレスポンスに含まれる。

**推奨構成：**
- n8n Webhook 中継でトークンを永続管理（ロジレスと同じ方式）
- ALF Code Node → n8n Webhook → n8n がトークン管理＋API実行 → 結果を返却
- n8n 側で毎回レスポンスの新しいトークンを保存する

---

## 設計ルール

### コードノード構成の判断基準

| 条件 | 構成 |
|------|------|
| 検索＋取得＋判定が単純 | **1ノード完結** |
| 更新処理あり（楽観的排他制御が必要） | **二層構造**（Code Node A: 検索 → Code Node B: 更新） |

### フィールド選択の原則

**タスクの分岐・判定・案内に使わないフィールドは含めない。**
ネクストエンジンは `fields` パラメータが必須で、指定が多いほど処理が遅くなる。最小限に絞ること。

### memorySchema 登録ルール

🔴 コードノードで `memory.put()` / `memory.get()` するキーは **すべて** Task JSON の `memorySchema` に登録すること。

---

## API基本仕様

| 項目 | 値 |
|------|-----|
| ベースURL | `https://api.next-engine.org` |
| 認証 | `access_token`（1日）+ `refresh_token`（3日） |
| 通信方式 | **全エンドポイント HTTP POST** |
| Content-Type | `application/x-www-form-urlencoded` |
| レスポンス形式 | JSON |
| 更新データ形式 | **XML**（`data` パラメータ） |
| 排他制御 | `receive_order_last_modified_date`（楽観的ロック） |

⚠️ ネクストエンジンAPIは **全て POST メソッド**（GETではない）。検索も POST。
⚠️ 更新の `data` パラメータは **XML 形式**。JSON ではない。

### プレースホルダー

| プレースホルダー | 説明 |
|---------------|------|
| `NE_ACCESS_TOKEN` | アクセストークン（n8n中継の場合は n8n Webhook URL に置換） |
| `NE_REFRESH_TOKEN` | リフレッシュトークン（n8n中継の場合は不要） |

---

## 主要エンドポイント

| 操作 | エンドポイント | 備考 |
|------|--------------|----|
| 受注伝票検索 | `/api_v1_receiveorder_base/search` | `fields` 必須 |
| 受注伝票更新 | `/api_v1_receiveorder_base/update` | XML形式、楽観的排他制御 |
| 受注伝票一括更新 | `/api_v1_receiveorder_base/bulkupdate` | |
| 出荷確定処理 | `/api_v1_receiveorder_base/shipped` | ステータス20/40のみ |
| 受注明細検索 | `/api_v1_receiveorder_row/search` | |
| 商品マスタ検索 | `/api_v1_master_goods/search` | |
| 在庫マスタ検索 | `/api_v1_master_stock/search` | |

### 検索演算子

パラメータ名に `-演算子` を付けて検索条件を指定する。

| 演算子 | 意味 | 例 |
|--------|------|----|
| `-eq` | 完全一致 | `receive_order_id-eq=12345` |
| `-neq` | 不一致 | |
| `-lt` / `-gt` | より小さい / より大きい | 日時・数値のみ |
| `-lte` / `-gte` | 以下 / 以上 | |
| `-in` | IN（カンマ区切り、最大1000） | `receive_order_order_status_id-in=10,20` |
| `-like` | LIKE（%ワイルドカード） | `receive_order_shop_cut_form_id-like=%TEST%` |
| `-blank` / `-nblank` | NULL or 空文字 / NOT NULL | |

---

## ステータス体系

### 受注状態区分（receive_order_order_status_id）

| コード | 状態名 | 備考 |
|--------|--------|------|
| 10 | 新規受付 | |
| 20 | 納品書印刷待ち | 更新・出荷確定可 |
| 40 | 納品書印刷済み | 更新・出荷確定可 |
| 50 | 出荷確定済（完了） | 原則更新不可（`shipped_update_flag=1` で一部可） |

### キャンセル区分（receive_order_cancel_type_id）

| コード | 意味 |
|--------|------|
| 0 | 有効（キャンセルではない） |
| 1 | 顧客依頼によりキャンセル |
| 2 | 在庫不足によりキャンセル |
| 3 | 他の伝票への統合のためキャンセル |

⚠️ キャンセル・住所変更可能なステータス範囲は **クライアントの要件次第**。API側では出荷確定済（50）は原則更新不可だが、`receive_order_shipped_update_flag=1` で強制更新可能。

---

## 前提ルール（コア部分・変更禁止）

### 注文番号の扱い
- 顧客入力の注文番号は memory の `input_order_number`
- `input_order_number` は **上書き禁止**
- ネクストエンジンは `receive_order_id`（伝票番号、NE内部ID）と `receive_order_shop_cut_form_id`（受注番号、店舗側の注文番号）が分離
- 顧客が伝えるのは通常 `receive_order_shop_cut_form_id`（店舗側の注文番号）
- 検索で `receive_order_id`（伝票番号）を取得して更新等に使う

### 検索フロー（省略禁止）
1. `receive_order_shop_cut_form_id-eq={入力値}` で完全一致検索
2. 0件なら `receive_order_shop_cut_form_id-like=%{入力値}%` で部分一致検索
3. 1件 → FOUND / 複数 → MULTIPLE / 0件 → NOT_FOUND
4. FOUND時は `receive_order_id` と `receive_order_last_modified_date` を必ず保存（更新APIに必須）

### レスポンス判定
```javascript
// result === "success" で成功判定
if (response?.data?.result !== 'success') {
  // error or redirect
  const code = response?.data?.code;
  const msg = response?.data?.message;
  // code === '002004' → refresh_token期限切れ（再認証必要）
}
```

---

## フィールドカタログ

### コアキー（必須・常に含める）

| memoryキー | 型 | 説明 |
|-----------|-----|------|
| `input_order_number` | string | 顧客入力（上書き禁止） |
| `retry_count` | number | 注文番号再確認回数（2回でオペレーター接続） |
| `ne_search_status` | string | FOUND / MULTIPLE / NOT_FOUND / ERROR |
| `ne_order_id` | string | NE伝票番号（更新APIに必要） |
| `ne_shop_order_id` | string | 店舗側受注番号 |
| `ne_last_modified_date` | string | 最終更新日（更新APIの楽観的排他制御に必須） |
| `ne_candidates` | listOfObject | 候補リスト |
| `ne_errorMessage` | string | エラー詳細 |

### 受注状態フィールド

| memoryキー | 型 | fieldsに指定する値 | 用途例 |
|-----------|-----|-------------------|--------|
| `ne_order_status_id` | string | `receive_order_order_status_id` | ステータス判定 |
| `ne_cancel_type_id` | string | `receive_order_cancel_type_id` | キャンセル済み判定 |
| `ne_order_date` | string | `receive_order_date` | 注文日 |
| `ne_send_date` | string | `receive_order_send_date` | 出荷確定日 |
| `ne_send_plan_date` | string | `receive_order_send_plan_date` | 出荷予定日 |
| `ne_tracking_code` | string | `receive_order_delivery_cut_form_id` | 追跡番号案内 |
| `ne_delivery_name` | string | `receive_order_delivery_name` | 発送方法名 |

### 購入者フィールド

| memoryキー | 型 | fieldsに指定する値 | 用途例 |
|-----------|-----|-------------------|--------|
| `ne_purchaser_name` | string | `receive_order_purchaser_name` | 購入者名 |
| `ne_purchaser_mail` | string | `receive_order_purchaser_mail_address` | メール案内 |
| `ne_purchaser_tel` | string | `receive_order_purchaser_tel` | 電話番号案内 |

### 送り先フィールド

| memoryキー | 型 | fieldsに指定する値 | 用途例 |
|-----------|-----|-------------------|--------|
| `ne_consignee_name` | string | `receive_order_consignee_name` | 送り先案内 |
| `ne_consignee_zip` | string | `receive_order_consignee_zip_code` | 住所変更確認 |
| `ne_consignee_address` | object | `receive_order_consignee_address1` + `address2` | 住所変更確認 |
| `ne_consignee_tel` | string | `receive_order_consignee_tel` | 電話番号案内 |

### 金額フィールド

| memoryキー | 型 | fieldsに指定する値 | 用途例 |
|-----------|-----|-------------------|--------|
| `ne_total_amount` | number | `receive_order_total_amount` | 総合計案内 |
| `ne_goods_amount` | number | `receive_order_goods_amount` | 商品計案内 |
| `ne_delivery_fee` | number | `receive_order_delivery_fee_amount` | 送料案内 |

### ユースケース別の選択ガイド

| ユースケース | コア | 受注状態 | 送り先 | 金額 |
|-------------|------|---------|--------|------|
| キャンセル可否 | ✅ | order_status_id, cancel_type_id | - | - |
| 配送先変更 | ✅ | order_status_id, cancel_type_id | ✅全部 | - |
| 追跡番号案内 | ✅ | order_status_id, tracking_code, delivery_name | - | - |
| 注文内容確認 | ✅ | order_status_id, order_date | purchaser_name | total_amount |
| 配送状況確認 | ✅ | order_status_id, send_date, tracking_code | - | - |

---

## コードテンプレート

### 検索コード

```javascript
const axios = require('axios');
const startedAt = Date.now();

try {
  const BASE_URL = 'https://api.next-engine.org';
  const ACCESS_TOKEN = 'NE_ACCESS_TOKEN';
  const REFRESH_TOKEN = 'NE_REFRESH_TOKEN';

  const inputOrderNumber = memory.get('input_order_number');

  // === retry_count: NOT_FOUND リトライ管理 ===
  const currentRetry = parseInt(memory.get('retry_count') || '0');
  memory.put('retry_count', currentRetry + 1);

  // === initKeys: コア（必須） ===
  memory.put('ne_search_status', null);
  memory.put('ne_order_id', null);
  memory.put('ne_shop_order_id', null);
  memory.put('ne_last_modified_date', null);
  memory.put('ne_candidates', []);
  memory.put('ne_errorMessage', null);
  // === initKeys: 選択フィールド（選択したもののみ記述） ===
  // [選択時のみ] memory.put('ne_order_status_id', null);
  // [選択時のみ] memory.put('ne_cancel_type_id', null);
  // [選択時のみ] memory.put('ne_order_date', null);
  // [選択時のみ] memory.put('ne_send_date', null);
  // [選択時のみ] memory.put('ne_send_plan_date', null);
  // [選択時のみ] memory.put('ne_tracking_code', null);
  // [選択時のみ] memory.put('ne_delivery_name', null);
  // [選択時のみ] memory.put('ne_purchaser_name', null);
  // [選択時のみ] memory.put('ne_purchaser_mail', null);
  // [選択時のみ] memory.put('ne_purchaser_tel', null);
  // [選択時のみ] memory.put('ne_consignee_name', null);
  // [選択時のみ] memory.put('ne_consignee_zip', null);
  // [選択時のみ] memory.put('ne_consignee_address', null);
  // [選択時のみ] memory.put('ne_consignee_tel', null);
  // [選択時のみ] memory.put('ne_total_amount', null);
  // [選択時のみ] memory.put('ne_goods_amount', null);
  // [選択時のみ] memory.put('ne_delivery_fee', null);

  if (!inputOrderNumber || String(inputOrderNumber).trim().length === 0) {
    memory.put('ne_search_status', 'ERROR');
    memory.put('ne_errorMessage', '注文番号（input_order_number）が入力されていません');
    await memory.save();
    return { ok: false };
  }

  const orderNo = String(inputOrderNumber).trim();

  // fields: コア必須 + 選択フィールド
  // ⚠️ 選択したフィールドのみ追加すること（多いほど遅くなる）
  const fields = [
    'receive_order_id',
    'receive_order_shop_cut_form_id',
    'receive_order_last_modified_date',
    // [選択時のみ] 'receive_order_order_status_id',
    // [選択時のみ] 'receive_order_cancel_type_id',
    // [選択時のみ] 'receive_order_date',
    // [選択時のみ] 'receive_order_send_date',
    // [選択時のみ] 'receive_order_send_plan_date',
    // [選択時のみ] 'receive_order_delivery_cut_form_id',
    // [選択時のみ] 'receive_order_delivery_name',
    // [選択時のみ] 'receive_order_purchaser_name',
    // [選択時のみ] 'receive_order_purchaser_mail_address',
    // [選択時のみ] 'receive_order_purchaser_tel',
    // [選択時のみ] 'receive_order_consignee_name',
    // [選択時のみ] 'receive_order_consignee_zip_code',
    // [選択時のみ] 'receive_order_consignee_address1',
    // [選択時のみ] 'receive_order_consignee_address2',
    // [選択時のみ] 'receive_order_consignee_tel',
    // [選択時のみ] 'receive_order_total_amount',
    // [選択時のみ] 'receive_order_goods_amount',
    // [選択時のみ] 'receive_order_delivery_fee_amount',
  ].join(',');

  // === 検索ロジック（固定・変更禁止） ===
  const search = async (params) => {
    const body = new URLSearchParams({
      access_token: ACCESS_TOKEN,
      refresh_token: REFRESH_TOKEN,
      wait_flag: '1',
      fields,
      limit: '5',
      ...params,
    });
    const response = await axios({
      url: `${BASE_URL}/api_v1_receiveorder_base/search`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: body.toString(),
      timeout: 30000,
    });
    if (response?.data?.result !== 'success') return [];
    return response?.data?.data || [];
  };

  // 完全一致検索
  console.log('[NE] Search exact:', orderNo);
  let orders = await search({ 'receive_order_shop_cut_form_id-eq': orderNo });

  // 完全一致0件 → 部分一致検索
  if (orders.length === 0) {
    console.log('[NE] Search like:', orderNo);
    orders = await search({ 'receive_order_shop_cut_form_id-like': `%${orderNo}%` });
  }

  if (orders.length === 0) {
    memory.put('ne_search_status', 'NOT_FOUND');
    memory.put('ne_candidates', []);
    await memory.save();
    return { ok: false };
  }

  // 完全一致で絞り込み
  const exactMatches = orders.filter(o => o.receive_order_shop_cut_form_id === orderNo);
  let selectedOrder = null;

  if (exactMatches.length === 1) {
    selectedOrder = exactMatches[0];
  } else if (exactMatches.length > 1) {
    memory.put('ne_search_status', 'MULTIPLE');
    memory.put('ne_candidates', exactMatches.map(o => ({
      order_id: o.receive_order_id,
      shop_order_id: o.receive_order_shop_cut_form_id,
    })));
    await memory.save();
    return { ok: false };
  } else if (orders.length === 1) {
    selectedOrder = orders[0];
  } else {
    memory.put('ne_search_status', 'MULTIPLE');
    memory.put('ne_candidates', orders.map(o => ({
      order_id: o.receive_order_id,
      shop_order_id: o.receive_order_shop_cut_form_id,
    })));
    await memory.save();
    return { ok: false };
  }

  // === FOUND: コア（必須） ===
  memory.put('ne_search_status', 'FOUND');
  memory.put('ne_order_id', String(selectedOrder.receive_order_id));
  memory.put('ne_shop_order_id', selectedOrder.receive_order_shop_cut_form_id || null);
  memory.put('ne_last_modified_date', selectedOrder.receive_order_last_modified_date || null);
  memory.put('ne_candidates', []);

  // === FOUND: 選択フィールド（選択したもののみ記述） ===

  // [選択時のみ] 受注状態フィールド
  // memory.put('ne_order_status_id', selectedOrder.receive_order_order_status_id || null);
  // memory.put('ne_cancel_type_id', selectedOrder.receive_order_cancel_type_id || null);
  // memory.put('ne_order_date', selectedOrder.receive_order_date || null);
  // memory.put('ne_send_date', selectedOrder.receive_order_send_date || null);
  // memory.put('ne_send_plan_date', selectedOrder.receive_order_send_plan_date || null);
  // memory.put('ne_tracking_code', selectedOrder.receive_order_delivery_cut_form_id || null);
  // memory.put('ne_delivery_name', selectedOrder.receive_order_delivery_name || null);

  // [選択時のみ] 購入者フィールド
  // memory.put('ne_purchaser_name', selectedOrder.receive_order_purchaser_name || null);
  // memory.put('ne_purchaser_mail', selectedOrder.receive_order_purchaser_mail_address || null);
  // memory.put('ne_purchaser_tel', selectedOrder.receive_order_purchaser_tel || null);

  // [選択時のみ] 送り先フィールド
  // memory.put('ne_consignee_name', selectedOrder.receive_order_consignee_name || null);
  // memory.put('ne_consignee_zip', selectedOrder.receive_order_consignee_zip_code || null);
  // memory.put('ne_consignee_address', {
  //   address1: selectedOrder.receive_order_consignee_address1 || null,
  //   address2: selectedOrder.receive_order_consignee_address2 || null,
  // });
  // memory.put('ne_consignee_tel', selectedOrder.receive_order_consignee_tel || null);

  // [選択時のみ] 金額フィールド
  // memory.put('ne_total_amount', selectedOrder.receive_order_total_amount || null);
  // memory.put('ne_goods_amount', selectedOrder.receive_order_goods_amount || null);
  // memory.put('ne_delivery_fee', selectedOrder.receive_order_delivery_fee_amount || null);

  await memory.save();
  console.log('[NE] FOUND:', selectedOrder.receive_order_id, 'in', Date.now() - startedAt, 'ms');
  return { ok: true };

} catch (err) {
  const message = err?.message ? String(err.message) : 'Unknown error';
  console.log('[NE] ERROR:', message);
  memory.put('ne_search_status', 'ERROR');
  memory.put('ne_errorMessage', message);
  await memory.save();
  return { ok: false };
}
```

---

## キャンセル実行

キャンセルは **更新APIで `cancel_type_id` を変更** する方式。`data` パラメータは XML。

```javascript
const orderId = memory.get('ne_order_id');
const lastModified = memory.get('ne_last_modified_date');

const xmlData = '<?xml version="1.0" encoding="utf-8"?><root><receiveorder_base><receive_order_cancel_type_id>1</receive_order_cancel_type_id></receiveorder_base></root>';

const body = new URLSearchParams({
  access_token: ACCESS_TOKEN,
  refresh_token: REFRESH_TOKEN,
  wait_flag: '1',
  receive_order_id: orderId,
  receive_order_last_modified_date: lastModified,
  data: xmlData,
});

const response = await axios({
  url: `${BASE_URL}/api_v1_receiveorder_base/update`,
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  data: body.toString(),
  timeout: 30000,
});

if (response?.data?.result !== 'success') {
  memory.put('ne_errorMessage', response?.data?.message || 'キャンセル処理に失敗しました');
}
```

⚠️ `receive_order_last_modified_date` は楽観的排他制御のため必須。検索時に取得した値を使う。他で更新済みならエラーが返る（再検索して再実行が必要）。

---

## 住所変更実行

```javascript
const orderId = memory.get('ne_order_id');
const lastModified = memory.get('ne_last_modified_date');

const xmlData = `<?xml version="1.0" encoding="utf-8"?>
<root>
  <receiveorder_base>
    <receive_order_consignee_name>${memory.get('new_consignee_name')}</receive_order_consignee_name>
    <receive_order_consignee_zip_code>${memory.get('new_zip_code')}</receive_order_consignee_zip_code>
    <receive_order_consignee_address1>${memory.get('new_address1')}</receive_order_consignee_address1>
    <receive_order_consignee_address2>${memory.get('new_address2') || ''}</receive_order_consignee_address2>
    <receive_order_consignee_tel>${memory.get('new_tel') || ''}</receive_order_consignee_tel>
  </receiveorder_base>
</root>`;

const body = new URLSearchParams({
  access_token: ACCESS_TOKEN,
  refresh_token: REFRESH_TOKEN,
  wait_flag: '1',
  receive_order_id: orderId,
  receive_order_last_modified_date: lastModified,
  data: xmlData,
});

const response = await axios({
  url: `${BASE_URL}/api_v1_receiveorder_base/update`,
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  data: body.toString(),
  timeout: 30000,
});
```

⚠️ 郵便番号・電話番号は **ハイフン不要**（例: `1234567`、`09012345678`）
⚠️ 出荷確定済（ステータス50）の伝票を更新する場合は `receive_order_shipped_update_flag=1` を追加

---

## 注意事項

- **全エンドポイントが POST**: GET メソッドは使わない。検索も POST
- **更新は XML 形式**: `data` パラメータに XML を文字列で渡す（JSON ではない）
- **楽観的排他制御**: 更新・出荷確定には `receive_order_last_modified_date` が必須。検索時に必ず取得すること
- **fields は最小限に**: 指定が多いほど遅くなる。必要なフィールドのみ指定
- **トークン管理**: access_token（1日）、refresh_token（3日）。n8n Webhook 中継を推奨
- **レスポンスのトークンを保存**: エラー時もトークンが更新される場合がある
- **メール取込済み伝票の制約**: 更新可能フィールドは `cancel_type_id`、`worker_text`、`gruoping_tag` のみ
- **受注明細の削除不可**: `receive_order_row_cancel_flag=1` でキャンセル済みにする
- **混雑時間帯**: 07:00〜22:00 は処理が遅くなる可能性あり。`wait_flag=1` 推奨

# CROSS MALL エンジン テンプレート

## 概要

受注・在庫一元管理システムが **CROSS MALL**（株式会社アイル）だと判明した場合に使用する。
**コア（検索ロジック）は固定、取得フィールドはタスクの目的に応じて選択する。**

### 🔴 CROSS MALL の特性

CROSS MALL APIは **参照系は強いが、更新系は限定的** なAPI。

- ✅ 注文検索・注文詳細取得・構成品取得・在庫取得/更新・商品取得/更新・フェーズ更新・Mark更新
- ❌ **注文キャンセルAPIなし**（cancel_flagを直接変更不可）
- ❌ **配送先住所変更APIなし**（取得のみ可能）
- ❌ **注文金額変更APIなし**

キャンセルや住所変更が必要な場合は、ステータス確認後にオペレーター接続するフローになる。
フェーズ移動（`upd_order_phase`）で「キャンセル」フェーズへの移動は可能だが、`cancel_flag`自体の変更ではない。

### 🔴 全APIがHTTP/GET

CROSS MALLは更新系を含む**全APIがHTTP/GET**方式。POSTは一切使わない。
パラメータはすべてURLクエリストリングで送信する。

### 🔴 レスポンスはXML

JSONではなく**XML形式**で返却される（UTF-8）。Code Node内でXMLパースが必要。

---

## 認証

### 認証方式

**IPアドレス制限 + MD5署名** の二重認証。OAuth不要、トークン更新不要。

| 項目 | 値 |
|------|-----|
| 認証鍵 | CROSSMALL管理画面で設定（永続、手動変更可） |
| 署名方式 | MD5（パラメータ文字列 + 認証鍵） |
| IP制限 | 最大24個のIPアドレスを許可リストに登録 |

### 署名の生成ルール

```
署名 = md5( URLエンコード済みパラメータ文字列 + 認証鍵 )
```

例:
- パラメータ: `account=ill&item_code=090115-z-01&attribute1_name=S&attribute2_name=Black`
- 認証鍵: `mXCTpnoA`
- 結合: `account=ill&item_code=090115-z-01&attribute1_name=S&attribute2_name=BlackmXCTpnoA`
- MD5: `db075c0464bd9cd150a1b60e397d8fb4`
- 最終URL: `https://crossmall.jp/webapi2/get_stock?account=ill&item_code=090115-z-01&attribute1_name=S&attribute2_name=Black&signing=db075c0464bd9cd150a1b60e397d8fb4`

⚠️ MD5変換前に**パラメータをURLエンコード**してから実施すること。

### 🔴 IPアドレス制限

CROSS MALLは接続元として**登録済みIPアドレスからのみ**リクエストを受け付ける。
ALF Code Node から直接呼ぶ場合、Channel Talk のサーバーIPをCROSSMALL管理画面に登録する必要がある。
**タスク納品時にIP一覧をクライアントに共有すること。**

初期設定は `0.0.0.0`（全拒否）。全IP許可する場合はすべて空欄で登録。

### トークン管理

**不要。** 認証鍵は永続で、GASによるリフレッシュは不要。
関数ノードでのトークン取得ステップも不要。

### プレースホルダー

| プレースホルダー | 説明 | 管理場所 |
|-------------|------|---------|
| `CM_ACCOUNT` | 会社コード（CROSSMALL管理画面 > システム設定 > 基本情報 > 会社コード） | Code Node |
| `CM_AUTH_KEY` | 認証鍵 | Code Node（Secret変数推奨） |

---

## API基本仕様

| 項目 | 値 |
|------|-----|
| ベースURL | `https://crossmall.jp/webapi2/` |
| リクエスト方式 | **全API HTTP/GET** |
| レスポンス形式 | **XML**（UTF-8） |
| 共通必須パラメータ | `account`（会社コード）, `signing`（MD5署名） |

---

## 主要エンドポイント

### 注文関連

| 操作 | エンドポイント | 最大件数 | 備考 |
|------|-----------|--------|------|
| 注文伝票検索 | `get_order` | 100件 | 管理番号/注文番号/日付/フェーズ/キャンセルフラグ等で絞り込み |
| 注文詳細取得 | `get_order_detail` | 上限なし | 管理番号必須。同梱子注文は指定不可 |
| 注文構成品取得 | `get_order_component` | - | セット品の構成品。管理番号+行No必須 |
| フェーズ更新 | `upd_order_phase` | - | フェーズ移動+発送日+配送番号+配送便名 |
| Mark更新 | `upd_order_check_mark` | - | チェックマーク1〜3のON/OFF |
| フェーズ一覧 | `get_phase` | - | アカウントの全フェーズ名一覧 |

### 在庫関連

| 操作 | エンドポイント | 最大件数 | 備考 |
|------|-----------|--------|------|
| 在庫取得 | `get_stock` | 上限なし | SKU/JAN/商品コードで検索 |
| 在庫差分取得 | `get_diff_stock` | 100件 | 更新日時(Fr)必須 |
| 在庫更新 | `upd_stock` | - | 上書(u)/加算(a)/削除(d) |

### 商品関連

| 操作 | エンドポイント | 最大件数 | 備考 |
|------|-----------|--------|------|
| 商品情報取得 | `get_item` | 100件 | 商品コード or 更新日時範囲 |
| 商品情報更新 | `upd_item` | - | 新規/更新/削除 |
| 商品属性取得 | `get_item_attribute` | - | 属性タイプ(①or②)指定 |
| 商品属性更新 | `upd_item_attribute` | - | |
| 商品SKU取得 | `get_item_sku` | - | |
| 商品SKU更新 | `upd_item_sku` | - | |

### その他

| 操作 | エンドポイント | 備考 |
|------|-----------|------|
| 送受信サービス状況取得 | `get_service_status` | 1:受信 2:送信 |
| 送受信サービス状況更新 | `upd_service_status` | 0:停止 3:開始 |

---

## 前提ルール（コア部分・変更禁止）

### 注文番号の扱い

CROSS MALLには2種類の番号がある:
- **管理番号（`order_number`）**: CROSSMALL内部の一意番号（8桁数字）。API検索のメインキー。
- **注文番号（`order_code`）**: ECモール側の注文番号（楽天、Yahoo!等の番号）。

顧客が入力するのは通常 `order_code`（モール注文番号）。
`order_number` はCROSSMALL内部管理用で顧客には見えないケースが多い。

### 検索フロー

1. 顧客から注文番号を取得 → `input_order_code` に保存
2. `get_order` で `order_code` を指定して検索
3. 結果の `order_number` を使って `get_order_detail` で詳細取得
4. `order_number` は条件に `condition=0`（完全一致）を使用

### ステータス管理

`order_search_status` に必ず保存: `FOUND` / `NOT_FOUND` / `ERROR`

### ページネーション

100件上限のAPIで次ページを取得する場合:
- `get_order`: `condition=1`（`>`）+ 直前の最大 `order_number` を指定
- `get_diff_stock`: `condition=1`（`>`）+ 直前の最大 `updated_at` を指定

---

## XMLパース共通ヘルパー

CROSS MALLのレスポンスはXMLのため、Code Node内で以下のパースロジックを使う。

```javascript
// XML → 値抽出ヘルパー（正規表現ベース）
function xmlVal(xml, tag) {
  const m = xml.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>'));
  return m ? m[1].trim() : '';
}

// XML → 複数Resultを配列で取得
function xmlResults(xml) {
  const results = [];
  const re = /<Result[^>]*>([\s\S]*?)<\/Result>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1]);
  }
  return results;
}

// レスポンスステータス確認
function xmlStatus(xml, statusTag) {
  // statusTag: 'GetStatus' or 'UpdStatus'
  return xmlVal(xml, statusTag);
}
```

---

## MD5署名生成ヘルパー

```javascript
const crypto = require('crypto');

function generateSigning(params, authKey) {
  // params: 'account=xxx&item_code=yyy&...' （signingを含まない）
  const encoded = encodeURIComponent(params).replace(/%26/g, '&').replace(/%3D/g, '=');
  // 実際にはパラメータ値のみURLエンコードし、&と=はそのまま
  const raw = params + authKey;
  return crypto.createHash('md5').update(raw).digest('hex');
}
```

⚠️ 署名生成時の注意:
- パラメータの**値部分**をURLエンコードしてからMD5変換
- `signing` パラメータ自体は署名対象に含めない
- パラメータの順序はリクエストURLと同一であること

---

## フィールドカタログ

### コアキー（必須・常に含める）

| memoryキー | 型 | 説明 |
|-----------|-----|------|
| `input_order_code` | string | 顧客入力の注文番号（モール側番号） |
| `retry_count` | number | 注文番号再確認回数（2回でオペレーター接続） |
| `order_search_status` | string | FOUND / NOT_FOUND / ERROR |
| `cm_order_number` | string | CROSSMALL管理番号（内部ID） |
| `errorMessage` | string | エラー詳細 |

### 注文伝票フィールド（get_order）

| memoryキー | 型 | XMLタグ | 用途例 |
|-----------|-----|--------|--------|
| `cm_order_date` | string | `order_date` | 注文日時（yyyy/mm/dd hh:mm:ss） |
| `cm_shop_name` | string | `shop_name` | 店舗名（楽天、Yahoo!等） |
| `cm_order_code` | string | `order_code` | モール側注文番号 |
| `cm_phase_name` | string | `phase_name` | 処理フェーズ（注文確認/発送待ち/完了等） |
| `cm_cancel_flag` | string | `cancel_flag` | キャンセルフラグ（0:通常/1:保留/2:キャンセル） |
| `cm_client_name` | string | `client_name` | 注文者氏名 |
| `cm_client_tel` | string | `client_tel` | 注文者TEL |
| `cm_client_mail` | string | `client_mail` | 注文者メール |
| `cm_ship_name` | string | `ship_name` | 届け先氏名 |
| `cm_ship_zip` | string | `ship_zip` | 届け先郵便番号 |
| `cm_ship_address1` | string | `ship_address1` | 届け先住所１ |
| `cm_ship_address2` | string | `ship_address2` | 届け先住所２ |
| `cm_ship_tel` | string | `ship_tel` | 届け先TEL |
| `cm_delivery_number` | string | `delivery_number` | 配送番号（追跡番号） |
| `cm_delivery_name` | string | `delivery_name` | 配送便名 |
| `cm_delivery_date` | string | `delivery_date` | 発送日（yyyy-mm-dd） |
| `cm_delivery_req_date` | string | `delivery_req_date` | 配送希望日 |
| `cm_delivery_time_name` | string | `delivery_time_name` | 配送時間帯名 |
| `cm_payment_name` | string | `payment_name` | 支払方法名 |
| `cm_subtotal_price` | string | `subtotal_price` | 小計 |
| `cm_total_price` | string | `total_price` | 合計 |
| `cm_order_memo` | string | `order_memo` | 備考 |
| `cm_delivery_memo` | string | `delivery_memo` | 配送備考 |
| `cm_bundle_flag` | string | `bundle_flag` | 同梱フラグ（0:通常/1:同梱） |

### 注文詳細フィールド（get_order_detail）

| memoryキー | 型 | XMLタグ | 用途例 |
|-----------|-----|--------|--------|
| `cm_detail_items` | string | 複数Resultから構築 | 商品明細の要約テキスト |
| `cm_line_count` | number | TotalResult | 明細行数 |

各明細行に含まれる主要フィールド:
- `item_code`, `item_name`, `attribute1_name`, `attribute2_name`
- `amount`（数量）, `unit_price`（単価）, `amount_price`（金額）
- `tax_type`, `reduced_tax_rate_type`, `component_flag`（セット品フラグ）

### 在庫フィールド（get_stock）

| memoryキー | 型 | XMLタグ | 用途例 |
|-----------|-----|--------|--------|
| `cm_stock` | number | `stock` | 在庫数量 |
| `cm_item_cd` | string | `item_cd` | 商品コード |
| `cm_attribute1_name` | string | `attribute1_name` | 属性１名 |
| `cm_attribute2_name` | string | `attribute2_name` | 属性２名 |

---

## コードノードテンプレート

### パターン1: 注文検索（注文番号で検索）

```javascript
const crypto = require('crypto');
const axios = require('axios');

const account = 'CM_ACCOUNT';
const authKey = 'CM_AUTH_KEY';
const orderCode = memory.get('input_order_code');

let searchStatus = 'ERROR';
let errorMsg = '';

try {
  if (!orderCode) {
    searchStatus = 'NOT_FOUND';
    errorMsg = '注文番号が入力されていません';
  } else {
    // パラメータ構築（signing以外）
    const params = `account=${encodeURIComponent(account)}&order_code=${encodeURIComponent(orderCode)}`;
    const signing = crypto.createHash('md5').update(params + authKey).digest('hex');
    const url = `https://crossmall.jp/webapi2/get_order?${params}&signing=${signing}`;

    const res = await axios.get(url, { timeout: 15000 });
    const xml = res.data;

    // ステータス確認
    const status = (xml.match(/<GetStatus>([\s\S]*?)<\/GetStatus>/) || [])[1] || '';
    if (status !== 'success') {
      const msg = (xml.match(/<Message>([\s\S]*?)<\/Message>/) || [])[1] || '';
      errorMsg = 'API Error: ' + msg;
    } else {
      const totalMatch = xml.match(/TotalResult=['"](\d+)['"]/);
      const total = totalMatch ? parseInt(totalMatch[1]) : 0;

      if (total === 0) {
        searchStatus = 'NOT_FOUND';
        errorMsg = '該当する注文が見つかりませんでした';
      } else {
        searchStatus = 'FOUND';
        // 最初のResultから情報抽出
        const resultMatch = xml.match(/<Result[^>]*>([\s\S]*?)<\/Result>/);
        if (resultMatch) {
          const r = resultMatch[1];
          const v = (tag) => { const m = r.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>')); return m ? m[1].trim() : ''; };

          memory.put('cm_order_number', v('order_number'));
          memory.put('cm_order_date', v('order_date'));
          memory.put('cm_shop_name', v('shop_name'));
          memory.put('cm_order_code', v('order_code'));
          memory.put('cm_phase_name', v('phase_name'));
          memory.put('cm_cancel_flag', v('cancel_flag'));
          memory.put('cm_client_name', v('client_name'));
          memory.put('cm_ship_name', v('ship_name'));
          memory.put('cm_ship_zip', v('ship_zip'));
          memory.put('cm_ship_address1', v('ship_address1'));
          memory.put('cm_ship_address2', v('ship_address2'));
          memory.put('cm_ship_tel', v('ship_tel'));
          memory.put('cm_delivery_number', v('delivery_number'));
          memory.put('cm_delivery_name', v('delivery_name'));
          memory.put('cm_delivery_date', v('delivery_date'));
          memory.put('cm_delivery_req_date', v('delivery_req_date'));
          memory.put('cm_delivery_time_name', v('delivery_time_name'));
          memory.put('cm_payment_name', v('payment_name'));
          memory.put('cm_subtotal_price', v('subtotal_price'));
          memory.put('cm_total_price', v('total_price'));
          memory.put('cm_order_memo', v('order_memo'));
          memory.put('cm_delivery_memo', v('delivery_memo'));
        }
      }
    }
  }
} catch (e) {
  errorMsg = 'システムエラー: ' + (e.message || '不明');
}

memory.put('order_search_status', searchStatus);
memory.put('errorMessage', errorMsg);
memory.save();
```

### パターン2: 注文詳細取得（管理番号で詳細取得）

```javascript
const crypto = require('crypto');
const axios = require('axios');

const account = 'CM_ACCOUNT';
const authKey = 'CM_AUTH_KEY';
const orderNumber = memory.get('cm_order_number');
let detailItems = '';
let lineCount = 0;

try {
  const params = `account=${encodeURIComponent(account)}&order_number=${encodeURIComponent(orderNumber)}`;
  const signing = crypto.createHash('md5').update(params + authKey).digest('hex');
  const url = `https://crossmall.jp/webapi2/get_order_detail?${params}&signing=${signing}`;

  const res = await axios.get(url, { timeout: 15000 });
  const xml = res.data;

  const status = (xml.match(/<GetStatus>([\s\S]*?)<\/GetStatus>/) || [])[1] || '';
  if (status === 'success') {
    const totalMatch = xml.match(/TotalResult=['"](\d+)['"]/);
    lineCount = totalMatch ? parseInt(totalMatch[1]) : 0;

    // 全明細を抽出して要約
    const results = [];
    const re = /<Result[^>]*>([\s\S]*?)<\/Result>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const r = m[1];
      const v = (tag) => { const mm = r.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>')); return mm ? mm[1].trim() : ''; };
      const name = v('item_name');
      const attr1 = v('attribute1_name');
      const attr2 = v('attribute2_name');
      const amount = v('amount');
      const price = v('amount_price');
      let line = `${name}`;
      if (attr1) line += `（${attr1}`;
      if (attr2) line += `/${attr2}`;
      if (attr1) line += `）`;
      line += ` × ${amount}個 ¥${price}`;
      results.push(line);
    }
    detailItems = results.join('\n');
  }
} catch (e) {
  // エラーは無視（注文伝票取得済みのため）
}

memory.put('cm_detail_items', detailItems);
memory.put('cm_line_count', lineCount);
memory.save();
```

### パターン3: 在庫照会

```javascript
const crypto = require('crypto');
const axios = require('axios');

const account = 'CM_ACCOUNT';
const authKey = 'CM_AUTH_KEY';
const itemCode = memory.get('input_item_code');

let stockResult = 'ERROR';
let stockInfo = '';

try {
  const params = `account=${encodeURIComponent(account)}&item_code=${encodeURIComponent(itemCode)}`;
  const signing = crypto.createHash('md5').update(params + authKey).digest('hex');
  const url = `https://crossmall.jp/webapi2/get_stock?${params}&signing=${signing}`;

  const res = await axios.get(url, { timeout: 15000 });
  const xml = res.data;

  const status = (xml.match(/<GetStatus>([\s\S]*?)<\/GetStatus>/) || [])[1] || '';
  if (status === 'success') {
    const results = [];
    const re = /<Result[^>]*>([\s\S]*?)<\/Result>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const r = m[1];
      const v = (tag) => { const mm = r.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>')); return mm ? mm[1].trim() : ''; };
      results.push(`${v('attribute1_name')}/${v('attribute2_name')}: ${v('stock')}個`);
    }
    stockResult = results.length > 0 ? 'FOUND' : 'NOT_FOUND';
    stockInfo = results.join('\n');
  }
} catch (e) {
  stockInfo = 'エラー: ' + (e.message || '不明');
}

memory.put('stock_search_status', stockResult);
memory.put('cm_stock_info', stockInfo);
memory.save();
```

### パターン4: フェーズ更新（発送情報更新）

```javascript
const crypto = require('crypto');
const axios = require('axios');

const account = 'CM_ACCOUNT';
const authKey = 'CM_AUTH_KEY';
const orderNumber = memory.get('cm_order_number');
const afterPhase = memory.get('target_phase_name');
const deliveryNo = memory.get('input_delivery_no') || '';
const deliveryDate = memory.get('input_delivery_date') || '';

let updateStatus = 'ERROR';
let errorMsg = '';

try {
  let params = `account=${encodeURIComponent(account)}&order_number=${encodeURIComponent(orderNumber)}&after_phase_name=${encodeURIComponent(afterPhase)}`;
  if (deliveryNo) params += `&delivery_no=${encodeURIComponent(deliveryNo)}`;
  if (deliveryDate) params += `&delivery_date=${encodeURIComponent(deliveryDate)}`;

  const signing = crypto.createHash('md5').update(params + authKey).digest('hex');
  const url = `https://crossmall.jp/webapi2/upd_order_phase?${params}&signing=${signing}`;

  const res = await axios.get(url, { timeout: 15000 });
  const xml = res.data;

  const status = (xml.match(/<UpdStatus>([\s\S]*?)<\/UpdStatus>/) || [])[1] || '';
  if (status === 'success') {
    updateStatus = 'SUCCESS';
  } else {
    const msg = (xml.match(/<Message>([\s\S]*?)<\/Message>/) || [])[1] || '';
    errorMsg = msg || 'フェーズ更新に失敗しました';
  }
} catch (e) {
  errorMsg = 'システムエラー: ' + (e.message || '不明');
}

memory.put('phase_update_status', updateStatus);
memory.put('errorMessage', errorMsg);
memory.save();
```

---

## ノード構成パターン

### パターンA: 注文状況確認タスク（参照のみ）

```
トリガー
  → Agent: 注文番号ヒアリング
  → Code: 注文検索（get_order）
  → Branch: order_search_status
    → FOUND → Agent: 注文状況案内（フェーズ・配送番号・届け先）
    → NOT_FOUND → Agent: 注文番号再確認（retry_count制御）
    → ERROR → Message: エラー案内 → オペレーター接続
```

### パターンB: 注文状況確認 + 詳細（二段取得）

```
トリガー
  → Agent: 注文番号ヒアリング
  → Code: 注文検索（get_order）
  → Branch: order_search_status
    → FOUND → Code: 注文詳細取得（get_order_detail）
              → Agent: 注文状況+商品明細案内
    → NOT_FOUND → Agent: 再確認
    → ERROR → Message: エラー → オペレーター接続
```

### パターンC: キャンセル依頼（フェーズ移動 or オペレーター接続）

```
トリガー
  → Agent: 注文番号ヒアリング + キャンセル理由確認
  → Code: 注文検索（get_order）
  → Branch: order_search_status
    → FOUND → Branch: cm_phase_name（フェーズ確認）
      → 注文確認 → Code: フェーズ更新（upd_order_phase → キャンセルフェーズ）
                  → Agent: キャンセル完了案内
      → 発送待ち/完了 → Message: 発送済みのためキャンセル不可 → オペレーター接続
    → NOT_FOUND → Agent: 再確認
```

### パターンD: 配送先変更依頼（照会 → オペレーター接続）

```
トリガー
  → Agent: 注文番号ヒアリング
  → Code: 注文検索（get_order）
  → Branch: order_search_status
    → FOUND → Agent: 現在の配送先を案内 + 「変更はオペレーターが対応」案内
              → Message: オペレーター接続メッセージ → オペレーター接続
    → NOT_FOUND → Agent: 再確認
```

---

## 注意事項

### 文字数制限

CROSS MALLの注文検索レスポンスは非常に大きい（1件あたり50+フィールド）。
**必要なフィールドだけを `memory.put()` すること**。全フィールドを保存するとtaskMemoryの容量制限に抵触する可能性がある。

### ページネーション（100件制限）

`get_order`, `get_item`, `get_diff_stock`, `get_diff_item_sku` は最大100件。
ALF Taskでの注文検索は通常1件（注文番号指定）なので問題ないが、バッチ処理的な使い方をする場合は `condition=1`（`>`）で繰り返し取得する設計が必要。

### 配送便名の更新時の配送時間帯

`upd_order_phase` で `delivery_name`（配送便名）を更新すると、配送時間帯の自動変換が発生する:
1. 更新後の配送便に同一名称の配送時間帯が存在 → 自動マッピング
2. 存在しない場合 → `delivery_time_convert_error` パラメータで制御
   - `0`: 更新不可（エラー返却）
   - `1`: 配送時間帯を未設定で更新

### cancel_flagとフェーズの関係

`cancel_flag` を直接 `2`（キャンセル）に変更するAPIはないが、`upd_order_phase` でキャンセル用フェーズに移動すること自体は可能。ただし、`cancel_flag` の値が自動で変わるかはCROSSMALLの内部動作に依存するため、**クライアントに事前確認が必要**。

### 同梱注文の制約

`get_order_detail` と `get_order_component` は**同梱子注文（`bundle_flag=1` の子）は指定不可**。同梱先管理番号（`bundle_ahead_number`）で親注文を検索する必要がある。

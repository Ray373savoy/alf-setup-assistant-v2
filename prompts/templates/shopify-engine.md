# Shopify エンジン テンプレート

## 概要

ユーザーのカートシステムが **Shopify** だと判明した場合に使用する。
**コア（検索ロジック）は固定、取得フィールドはタスクの目的に応じて選択する。**

---

## 設計ルール

### コードノード構成の判断基準

| 条件 | 構成 |
|------|------|
| 検索＋取得＋判定が単純（分岐1つ程度） | **1ノード完結**（コア + フィールド取得 + 判定を1つの code ノードに） |
| 判定ロジックが複雑（複数条件の組み合わせ、追加API呼び出し等） | **二層構造**（Code Node A: 検索＋取得 / Code Node B: 判定＋実行） |

判断に迷ったら **1ノード完結を優先**。ノード数が少ない方がエラーリスクが低い。

### フィールド選択の原則

**タスクの分岐・判定・案内に使わないフィールドは含めない。**

例：「追跡番号案内」タスクなら、`lineItems`（商品明細）や `shippingAddress`（配送先住所）は不要。
例：「キャンセル可否判定」タスクなら、`fulfillments`（追跡番号）は不要。

### memorySchema 登録ルール

🔴 コードノードで `memory.put()` / `memory.get()` するキーは **すべて** Task JSON の `memorySchema` に登録すること。選択したフィールドに対応するキーだけを登録する（カタログ全量ではない）。

---

## 前提ルール（コア部分・変更禁止）

### 注文番号の扱い
- 顧客入力の注文番号は memory の `input_order_Number`
- `input_order_Number` は **上書き禁止**
- 入力は `1058` / `#1058` のように揺れる → 正規化して `normalized_order_Number` を作る

### 検索フロー（省略禁止）
1. 完全一致狙い：`name:#<数字>`
2. 見つからなければ補助：`name:*<数字>*`（first:5）
3. 候補内で `node.name === "#<数字>"` の完全一致があれば採用
4. 完全一致なしで候補が複数なら `MULTIPLE`
5. 0件なら `NOT_FOUND`

### ステータス管理
`order_search_status` に必ず保存：`FOUND` / `MULTIPLE` / `NOT_FOUND` / `ERROR`

### APIキーのプレースホルダー
- `XXXXXXXX.myshopify.com` / `shpat_XXXXXXXX`

---

## フィールドカタログ

以下からタスクに必要なフィールドのみを選択する。

### コアキー（必須・常に含める）

| memoryキー | 型 | 説明 |
|-----------|-----|------|
| `input_order_Number` | string | 顧客入力（上書き禁止） |
| `retry_count` | number | 注文番号再確認回数（2回でオペレーター接続） |
| `normalized_order_Number` | string | 正規化済み |
| `order_search_status` | string | FOUND / MULTIPLE / NOT_FOUND / ERROR |
| `order_candidates` | listOfObject | 候補注文リスト（最大5件） |
| `shopify_order_id` | string | FOUND時のみ |
| `shopify_order_name` | string | FOUND時のみ |
| `errorMessage` | string | エラー詳細 |

### 注文状態フィールド

| memoryキー | 型 | GraphQL フィールド | 用途例 |
|-----------|-----|-------------------|--------|
| `shopify_displayFulfillmentStatus` | string | `displayFulfillmentStatus` | 発送済み/未発送の判定 |
| `shopify_displayFinancialStatus` | string | `displayFinancialStatus` | 決済状態の確認 |
| `shopify_cancelledAt` | string | `cancelledAt` | キャンセル済みかどうか |
| `shopify_createdAt` | string | `createdAt` | 注文日（期限判定に使用） |
| `shopify_processedAt` | string | `processedAt` | 処理日時 |

### 配送・追跡フィールド

| memoryキー | 型 | GraphQL フィールド | 用途例 |
|-----------|-----|-------------------|--------|
| `shopify_trackingNumbers` | list | `fulfillments.trackingInfo.number` | 追跡番号の案内 |
| `shopify_fulfillment_summary` | object | `fulfillments` から算出 | 出荷件数サマリ |

### 顧客・配送先フィールド

| memoryキー | 型 | GraphQL フィールド | 用途例 |
|-----------|-----|-------------------|--------|
| `shopify_customer_email` | string | `customer.email` | メール通知判定 |
| `shopify_shippingAddress_summary` | object | `shippingAddress` | 住所変更の確認 |

### 注文内容フィールド

| memoryキー | 型 | GraphQL フィールド | 用途例 |
|-----------|-----|-------------------|--------|
| `shopify_lineItems` | listOfObject | `lineItems(first:10)` | 商品明細の案内・返品対象の特定 |
| `shopify_totalPrice_summary` | object | `totalPriceSet.presentmentMoney` | 金額の案内 |

### ユースケース別の選択ガイド

| ユースケース | コア | 注文状態 | 配送追跡 | 顧客 | 住所 | 商品 | 金額 |
|-------------|------|---------|---------|------|------|------|------|
| 追跡番号案内 | ✅ | fulfillmentStatus | ✅全部 | - | - | - | - |
| キャンセル可否 | ✅ | ✅全部 | - | - | - | - | - |
| 配送先変更可否 | ✅ | fulfillmentStatus | - | - | ✅ | - | - |
| 返品・交換受付 | ✅ | fulfillmentStatus, createdAt | - | - | - | ✅ | - |
| 注文内容確認 | ✅ | fulfillmentStatus, financialStatus | - | - | - | ✅ | ✅ |

---

## コードテンプレート

以下のテンプレートを使い、**選択したフィールドのみ** GraphQL クエリと memory 保存処理に含める。
`// [選択時のみ]` コメントが付いた部分は、該当フィールドを選択した場合のみ含め、選択しない場合は**行ごと削除する**。

```javascript
const axios = require('axios');
const startedAt = Date.now();

try {
  const SHOPIFY_DOMAIN = 'XXXXXXXX.myshopify.com';
  const ACCESS_TOKEN = 'shpat_XXXXXXXX';
  const API_VERSION = '2024-01';

  const inputOrderNumberRaw = memory.get('input_order_Number');

  // === retry_count: NOT_FOUND リトライ管理 ===
  const currentRetry = parseInt(memory.get('retry_count') || '0');
  memory.put('retry_count', currentRetry + 1);

  // === initKeys: コア（必須） ===
  memory.put('normalized_order_Number', null);
  memory.put('order_search_status', null);
  memory.put('order_candidates', []);
  memory.put('shopify_order_id', null);
  memory.put('shopify_order_name', null);
  memory.put('errorMessage', null);
  // === initKeys: 選択フィールド（選択したもののみ記述） ===
  // [選択時のみ] memory.put('shopify_displayFulfillmentStatus', null);
  // [選択時のみ] memory.put('shopify_displayFinancialStatus', null);
  // [選択時のみ] memory.put('shopify_cancelledAt', null);
  // [選択時のみ] memory.put('shopify_createdAt', null);
  // [選択時のみ] memory.put('shopify_processedAt', null);
  // [選択時のみ] memory.put('shopify_trackingNumbers', []);
  // [選択時のみ] memory.put('shopify_fulfillment_summary', null);
  // [選択時のみ] memory.put('shopify_customer_email', null);
  // [選択時のみ] memory.put('shopify_shippingAddress_summary', null);
  // [選択時のみ] memory.put('shopify_lineItems', []);
  // [選択時のみ] memory.put('shopify_totalPrice_summary', null);

  if (!inputOrderNumberRaw || String(inputOrderNumberRaw).trim().length === 0) {
    memory.put('order_search_status', 'ERROR');
    memory.put('errorMessage', '注文番号（input_order_Number）が入力されていません');
    await memory.save();
    return { ok: false };
  }

  const raw = String(inputOrderNumberRaw).trim();
  const normalized = raw.replace(/\s+/g, '').replace(/^#/, '');
  memory.put('normalized_order_Number', normalized);

  if (normalized.length === 0) {
    memory.put('order_search_status', 'ERROR');
    memory.put('errorMessage', '注文番号の正規化に失敗しました');
    await memory.save();
    return { ok: false };
  }

  const exactName = `#${normalized}`;

  // === GraphQLクエリ: 選択フィールドのみ含める ===
  const query = `
    query($q: String!, $first: Int!) {
      orders(first: $first, query: $q) {
        edges {
          node {
            id
            name
            // [選択時のみ] createdAt
            // [選択時のみ] processedAt
            // [選択時のみ] cancelledAt
            // [選択時のみ] displayFulfillmentStatus
            // [選択時のみ] displayFinancialStatus
            // [選択時のみ] totalPriceSet { presentmentMoney { amount currencyCode } }
            // [選択時のみ] customer { email }
            // [選択時のみ] shippingAddress { zip province city country }
            // [選択時のみ] fulfillments(first: 10) { trackingInfo(first: 10) { number } }
            // [選択時のみ] lineItems(first: 10) { edges { node { title quantity sku variantTitle } } }
          }
        }
      }
    }
  `;

  const callShopify = async (q, first) => {
    const response = await axios({
      url: `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': ACCESS_TOKEN,
      },
      data: { query, variables: { q, first } },
      timeout: 20000,
    });
    return response?.data?.data?.orders?.edges || [];
  };

  // === 検索ロジック（固定・変更禁止） ===
  const toCandidates = (edges) =>
    edges.map((e) => e?.node).filter(Boolean).map((n) => ({ id: n.id, name: n.name }));

  console.log('[Shopify] Search exact:', exactName);
  const exactEdges = await callShopify(`name:${exactName}`, 5);
  const exactNodes = exactEdges.map((e) => e?.node).filter(Boolean);
  const exactMatches = exactNodes.filter((n) => n?.name === exactName);

  let selectedNode = null;

  if (exactMatches.length === 1) {
    selectedNode = exactMatches[0];
  } else if (exactMatches.length > 1) {
    memory.put('order_search_status', 'MULTIPLE');
    memory.put('order_candidates', exactMatches.map((n) => ({ id: n.id, name: n.name })));
    memory.put('errorMessage', `完全一致候補が複数見つかりました（${exactName}）`);
    await memory.save();
    return { ok: false };
  }

  if (!selectedNode) {
    console.log('[Shopify] Search wildcard');
    const wildcardEdges = await callShopify(`name:*${normalized}*`, 5);
    const wildcardNodes = wildcardEdges.map((e) => e?.node).filter(Boolean);

    if (wildcardNodes.length === 0) {
      memory.put('order_search_status', 'NOT_FOUND');
      memory.put('order_candidates', []);
      await memory.save();
      return { ok: false };
    }

    const wildcardExactMatches = wildcardNodes.filter((n) => n?.name === exactName);
    if (wildcardExactMatches.length === 1) {
      selectedNode = wildcardExactMatches[0];
    } else if (wildcardExactMatches.length > 1) {
      memory.put('order_search_status', 'MULTIPLE');
      memory.put('order_candidates', wildcardExactMatches.map((n) => ({ id: n.id, name: n.name })));
      await memory.save();
      return { ok: false };
    } else if (wildcardNodes.length === 1) {
      selectedNode = wildcardNodes[0];
    } else {
      memory.put('order_search_status', 'MULTIPLE');
      memory.put('order_candidates', toCandidates(wildcardEdges));
      await memory.save();
      return { ok: false };
    }
  }

  // === FOUND: コア（必須） ===
  memory.put('order_search_status', 'FOUND');
  memory.put('shopify_order_id', selectedNode.id || null);
  memory.put('shopify_order_name', selectedNode.name || null);
  memory.put('order_candidates', []);

  // === FOUND: 選択フィールド（選択したもののみ記述） ===

  // [選択時のみ] 注文状態
  // memory.put('shopify_displayFulfillmentStatus', selectedNode.displayFulfillmentStatus || null);
  // memory.put('shopify_displayFinancialStatus', selectedNode.displayFinancialStatus || null);
  // memory.put('shopify_cancelledAt', selectedNode.cancelledAt || null);
  // memory.put('shopify_createdAt', selectedNode.createdAt || null);
  // memory.put('shopify_processedAt', selectedNode.processedAt || null);

  // [選択時のみ] 配送・追跡
  // const trackNums = [];
  // for (const f of (selectedNode?.fulfillments || [])) {
  //   for (const info of (f?.trackingInfo || [])) {
  //     if (info?.number) trackNums.push(String(info.number).trim());
  //   }
  // }
  // const trackingNumbers = [...new Set(trackNums)];
  // memory.put('shopify_trackingNumbers', trackingNumbers);
  // memory.put('shopify_fulfillment_summary', {
  //   fulfillmentCount: (selectedNode?.fulfillments || []).length,
  //   trackingNumberCount: trackingNumbers.length,
  // });

  // [選択時のみ] 顧客情報
  // memory.put('shopify_customer_email', selectedNode?.customer?.email || null);

  // [選択時のみ] 配送先住所
  // const addr = selectedNode?.shippingAddress;
  // memory.put('shopify_shippingAddress_summary', addr
  //   ? { zip: addr.zip || null, province: addr.province || null, city: addr.city || null, country: addr.country || null }
  //   : null);

  // [選択時のみ] 商品明細
  // memory.put('shopify_lineItems', (selectedNode?.lineItems?.edges || [])
  //   .map((e) => e?.node).filter(Boolean)
  //   .map((li) => ({ title: li.title || null, quantity: li.quantity ?? null, sku: li.sku || null, variantTitle: li.variantTitle || null })));

  // [選択時のみ] 金額
  // const money = selectedNode?.totalPriceSet?.presentmentMoney;
  // memory.put('shopify_totalPrice_summary', money
  //   ? { amount: money.amount || null, currencyCode: money.currencyCode || null }
  //   : null);

  await memory.save();
  console.log('[Shopify] FOUND:', selectedNode.name, 'in', Date.now() - startedAt, 'ms');
  return { ok: true };

} catch (err) {
  const message = err?.message ? String(err.message) : 'Unknown error';
  console.log('[Shopify] ERROR:', message);
  memory.put('order_search_status', 'ERROR');
  memory.put('errorMessage', message);
  await memory.save();
  return { ok: false };
}
```

**使い方：** `// [選択時のみ]` が付いた行のうち、タスクで必要なフィールドのコメントを外し、不要なフィールドの行は削除する。コメントのまま残すと文字数の無駄になる。

---

## 二層構造を使う場合（Code Node B）

検索＋取得を Code Node A、判定＋実行を Code Node B に分離する場合：

### 分岐パターン（Code Node A → Branch → Code Node B）

```
order_search_status === "FOUND"     → Code Node B（ケース別判定）
order_search_status === "MULTIPLE"  → 候補一覧を提示して再入力を促す
order_search_status === "NOT_FOUND" → 注文が見つからない旨を案内
order_search_status === "ERROR"     → errorMessage を案内
```

### Code Node B の設計ガイド

Code Node B では Code Node A で保存済みの memory データを使って判定を行う。
**Code Node A で選択したフィールドのキーのみ参照可能。**

| ユースケース | Code Node B の判定例 |
|-------------|---------------------|
| キャンセル可否 | `fulfillmentStatus !== 'FULFILLED'` かつ `cancelledAt === null` |
| 配送先変更可否 | `fulfillmentStatus === 'UNFULFILLED'` |
| 追跡番号案内 | `trackingNumbers.length > 0` で分岐 |
| 返品可否 | `createdAt` から経過日数を算出し期限内判定 |

---

## ⚠️ コードノード文字数制限（実測値）

Channel Talk エディタには公式ドキュメント上「制限なし」と記載されているが、
**実運用では5,000文字を超えるとインポートエラーになるケースが確認されている**。

Code Node A（共通エンジン）のフル版テンプレートから全フィールドを選択すると約8,000文字になるため、以下の方針で対応すること：

| 状況 | 使用するテンプレート |
|------|---------------------|
| キャンセル・住所変更など **後続ノードで商品タグや配送先を参照しない** ケース | **スリム版（下記）** |
| 発送予定日案内・注文内容確認など **lineItems / shippingAddress を後続で使う** ケース | **フル版（上記）から必要フィールドのみ選択** |

**判定基準：後続のコードノードまたはエージェントノードで以下のキーを参照するか否か**

スリム版で省略されるキー：
`shopify_trackingNumbers` / `shopify_fulfillment_summary` / `shopify_customer_email` /
`shopify_shippingAddress_summary` / `shopify_lineItems` / `shopify_totalPrice_summary` /
`shopify_displayFulfillmentStatus` / `shopify_displayFinancialStatus` /
`shopify_cancelledAt` / `shopify_processedAt`

---

## Code Node A（スリム版）：約2,700文字

後続ノードで必要なのが `shopify_order_id` / `shopify_order_name` / `shopify_createdAt` のみの場合に使用する。

```javascript
const axios = require('axios');
try {
  const SHOPIFY_DOMAIN = 'XXXXXXXX.myshopify.com';
  const ACCESS_TOKEN = 'shpat_XXXXXXXX';
  const API_VERSION = '2024-01';

  const raw = String(memory.get('input_order_Number') || '').trim();
  if (!raw) {
    memory.put('order_search_status', 'ERROR');
    memory.put('errorMessage', '注文番号が入力されていません');
    await memory.save();
    return { ok: false };
  }

  const normalized = raw.replace(/\s+/g, '').replace(/^#/, '');
  memory.put('normalized_order_Number', normalized);
  const exactName = `#${normalized}`;

  const gql = `query($q:String!,$n:Int!){orders(first:$n,query:$q){edges{node{id name createdAt}}}}`;

  const search = async (q, n) => {
    const r = await axios({
      url: `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
      method: 'POST',
      headers: {'Content-Type':'application/json','X-Shopify-Access-Token':ACCESS_TOKEN},
      data: {query: gql, variables: {q, n}},
      timeout: 20000,
    });
    return (r?.data?.data?.orders?.edges || []).map(e => e?.node).filter(Boolean);
  };

  const save = (status, node) => {
    memory.put('order_search_status', status);
    if (node) {
      memory.put('shopify_order_id', node.id);
      memory.put('shopify_order_name', node.name);
      memory.put('shopify_createdAt', node.createdAt);
    }
  };

  // 完全一致検索
  let nodes = await search(`name:${exactName}`, 5);
  let exact = nodes.filter(n => n.name === exactName);
  if (exact.length === 1) { save('FOUND', exact[0]); memory.put('order_candidates', []); await memory.save(); return { ok: true }; }
  if (exact.length > 1) { save('MULTIPLE', null); memory.put('order_candidates', exact.map(n => ({id:n.id,name:n.name}))); await memory.save(); return { ok: false }; }

  // ワイルドカード補助検索
  nodes = await search(`name:*${normalized}*`, 5);
  exact = nodes.filter(n => n.name === exactName);
  if (exact.length === 1) { save('FOUND', exact[0]); memory.put('order_candidates', []); await memory.save(); return { ok: true }; }
  if (exact.length > 1 || nodes.length > 1) { save('MULTIPLE', null); memory.put('order_candidates', (exact.length > 1 ? exact : nodes).map(n => ({id:n.id,name:n.name}))); await memory.save(); return { ok: false }; }
  if (nodes.length === 1) { save('FOUND', nodes[0]); memory.put('order_candidates', []); await memory.save(); return { ok: true }; }

  save('NOT_FOUND', null); memory.put('order_candidates', []); await memory.save(); return { ok: false };

} catch (err) {
  memory.put('order_search_status', 'ERROR');
  memory.put('errorMessage', err?.message || 'Unknown error');
  await memory.save();
  return { ok: false };
}
```

**スリム版の memorySchema（フル版から不要キーを除いたもの）：**

```json
[
  { "key": "input_order_Number", "type": "string", "description": "顧客入力の注文番号" },
  { "key": "normalized_order_Number", "type": "string", "description": "正規化済み注文番号" },
  { "key": "order_search_status", "type": "string", "description": "検索結果ステータス（FOUND/MULTIPLE/NOT_FOUND/ERROR）" },
  { "key": "order_candidates", "type": "listOfObject", "description": "候補注文リスト" },
  { "key": "shopify_order_id", "type": "string", "description": "Shopify注文ID" },
  { "key": "shopify_order_name", "type": "string", "description": "Shopify注文名（例: #1058）" },
  { "key": "shopify_createdAt", "type": "string", "description": "注文作成日時" },
  { "key": "errorMessage", "type": "string", "description": "エラーメッセージ" }
]
```

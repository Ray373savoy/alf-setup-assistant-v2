# Task JSON 事前検証（Pre-Import Validation）

## 概要

生成した Task JSON を Channel Talk にインポートする前に、構造エラー・ランタイムエラーの
リスクを事前検出する。

検証は **3段階** で実施する：

1. **構造検証（Static）** — JSONスキーマ・ポリシー準拠チェック
2. **フロー検証（Flow）** — 分岐・接続の論理整合性チェック
3. **実行予測（Runtime Prediction）** — コードノードのエラー予測・API疎通確認

---

## Stage 1: 構造検証（Static Validation）

`task-policy.md` の 🔴 Critical 項目を自動チェック。

### チェック項目一覧

| # | カテゴリ | チェック内容 | 重大度 |
|---|---------|------------|--------|
| S01 | Task名 | 1〜50文字以内 | 🔴 |
| S02 | トリガー | 1〜5,000文字以内 | 🔴 |
| S03 | ノード数 | 100個以下 | 🔴 |
| S04 | Memory Key | 50個以下、重複なし | 🔴 |
| S05 | Memory Key | 命名規則（英数字・アンダースコアのみ） | 🔴 |
| S06 | AgentNode | instruction 10,000文字以下 | 🔴 |
| S07 | CodeNode | コード 5,000文字以内を目標（実運用でエラー確認済み） | 🟡 |
| S08 | MessageNode | メッセージ定義あり | 🔴 |
| S09 | edgePositions | 全ノード間に定義あり | 🔴 |
| S10 | ノードID | 重複なし | 🔴 |
| S11 | next参照 | 存在するノードIDを参照している | 🔴 |
| S12 | JSONパース | 有効なJSON構造 | 🔴 |
| S13 | memorySchema | 必須キーの型定義あり | 🟡 |
| S14 | promptdata | binding先のmemoryKeyが存在する | 🟡 |
| S15 | memorySchema完全性 | 全codeノードの memory.put/get キーが memorySchema に存在する | 🔴 |
| S16 | memorySchema完全性 | 全agentノードの promptdata identifier キーが memorySchema に存在する | 🔴 |
| S17 | memorySchema完全性 | 全branch条件の taskMemory.xxx キーが memorySchema に存在する | 🔴 |
| S18 | memorySchema型一致 | memory.put で保存する値の型と memorySchema の type が一致する | 🟡 |

### 出力形式

```
=== 構造検証レポート ===

✅ PASS: S01 Task名 (35文字)
✅ PASS: S02 トリガー (1,200文字)
❌ FAIL: S09 edgePositions — ノード "node_3" → "node_5" の定義が欠落
⚠️ WARN: S13 memorySchema — "order_status" の型定義がありません

結果: ❌ FAIL (1 critical, 1 warning)
```

### S15〜S17: memorySchema完全性チェックの詳細

```
=== memorySchema 完全性チェック ===

■ codeノード内の memory.put/get キー抽出:
  node-2 (code): put → order_search_status, shopify_order_id, shopify_order_name,
                        errorMessage, normalized_order_Number, order_candidates,
                        shopify_displayFulfillmentStatus, shopify_trackingNumbers,
                        shopify_fulfillment_summary
  node-2 (code): get → input_order_Number

■ agentノード内の promptdata キー抽出:
  node-5 (agent): read → shopify_trackingNumbers, shopify_order_name

■ branch条件内の taskMemory キー抽出:
  node-3 (branch): taskMemory.order_search_status

■ memorySchema との突合:
  input_order_Number               → memorySchema ✅
  normalized_order_Number          → memorySchema ✅
  order_search_status              → memorySchema ✅
  order_candidates                 → memorySchema ✅
  shopify_order_id                 → memorySchema ✅
  shopify_order_name               → memorySchema ✅
  shopify_displayFulfillmentStatus → memorySchema ✅
  shopify_trackingNumbers          → memorySchema ✅
  shopify_fulfillment_summary      → memorySchema ✅
  errorMessage                     → memorySchema ❌ 未登録！

■ 結果: ❌ FAIL — errorMessage が memorySchema に未登録
  → 修正: memorySchema に { "key": "errorMessage", "type": "string", "description": "エラーメッセージ" } を追加
```

---

## Stage 2: フロー検証（Flow Validation）

### チェック項目一覧

| # | カテゴリ | チェック内容 | 重大度 |
|---|---------|------------|--------|
| F01 | 循環検出 | DAG（有向非巡回グラフ）であること | 🔴 |
| F02 | 到達性 | 全ノードがトリガーから到達可能 | 🔴 |
| F03 | 終端性 | 全パスが END_TASK に到達可能 | 🔴 |
| F04 | 分岐完全性 | branch の全条件がカバーされている（else/default含む） | 🔴 |
| F05 | 分岐排他性 | 複数条件が同時にtrueにならない | 🟡 |
| F06 | デッドパス | 到達不可能なノードがない | 🟡 |
| F07 | Memory依存 | 読み取るmemoryKeyが書き込みノードの後にある | 🟡 |
| F08 | 無限ループリスク | agentノードのmaxTurn設定確認 | 🟡 |
| F09 | レイアウト近接 | 任意の2ノードが dx < 400 AND dy < 400 になっていないか | 🟡 |
| F10 | レイアウト重複 | 同一座標のノードが存在しないか | 🔴 |

### 分岐完全性の詳細チェック

```
分岐ノード "node_check_status" の検証:
  条件1: order_search_status === "FOUND"     → node_process  ✅
  条件2: order_search_status === "NOT_FOUND" → node_not_found ✅
  条件3: order_search_status === "MULTIPLE"  → node_multiple  ✅
  条件4: order_search_status === "ERROR"     → node_error     ✅
  デフォルト/else: なし  ⚠️ 想定外の値が来た場合のフォールバックがありません
```

### Memory依存性チェック

```
ノード実行順序でのmemory読み書き追跡:
  node_1 (code): WRITE → order_search_status, shopify_order_id
  node_2 (branch): READ ← order_search_status  ✅ (node_1で書き込み済み)
  node_3 (agent): READ ← shopify_lineItems     ❌ (どのノードでも書き込みされていない)
```

---

## Stage 3: 実行予測（Runtime Prediction）

### 3a. コードノード静的解析

| # | チェック内容 | 重大度 |
|---|------------|--------|
| R01 | `require()` の対象がALFランタイムで利用可能か（axios, crypto等） | 🔴 |
| R02 | `memory.get()` で未定義キーを参照していないか | 🔴 |
| R03 | `memory.put()` のキーが memorySchema に存在するか | 🔴 |
| R04 | `await memory.save()` が全パスの末尾で呼ばれているか | 🔴 |
| R05 | try-catch で外部API呼び出しが保護されているか | 🟡 |
| R06 | タイムアウト設定があるか（推奨: 20秒以下） | 🟡 |
| R07 | `console.log` でデバッグ情報が出力されているか | 🟢 |

### 3b. API疎通テスト（オプション：テスト認証情報が提供された場合）

テスト用の認証情報（Shopify domain/token、ロジレス merchant_id/token）が
提供された場合、以下の最小限のテストを実行できる：

#### Shopify疎通テスト
```javascript
// テスト内容: GraphQL introspection で接続確認
// 実データは取得しない（プライバシー保護）
const testQuery = `{ shop { name } }`;
// → 200 OK + shop.name が返れば接続成功
```

#### ロジレス疎通テスト
```javascript
// テスト内容: 受注伝票一覧を limit=1 で取得
// → 200 OK が返れば接続成功
GET /api/v1/merchant/{merchant_id}/sales_orders?limit=1
```

#### テスト結果の出力
```
=== API疎通テスト ===

Shopify:
  ✅ GraphQL接続: OK (shop: "test-store")
  ✅ 認証: OK
  ⚠️ APIバージョン: 2024-01（最新は 2024-10）

ロジレス:
  ✅ REST接続: OK
  ✅ 認証: OK
  ✅ merchant_id: 有効
```

---

## 総合レポート形式

```
╔══════════════════════════════════════╗
║   Task JSON 事前検証レポート          ║
╠══════════════════════════════════════╣
║                                      ║
║  Stage 1: 構造検証      ✅ PASS      ║
║    Critical: 0  Warning: 1           ║
║                                      ║
║  Stage 2: フロー検証    ⚠️ WARN      ║
║    Critical: 0  Warning: 2           ║
║    - F05: 分岐排他性（node_7）       ║
║    - F08: maxTurn未設定（node_2）    ║
║                                      ║
║  Stage 3: 実行予測      ✅ PASS      ║
║    Critical: 0  Warning: 0           ║
║    API疎通: Shopify ✅ ロジレス ✅    ║
║                                      ║
║  総合判定: ⚠️ 条件付きPASS           ║
║  → Warning 3件を確認の上インポート可  ║
║                                      ║
╚══════════════════════════════════════╝
```

---

## Shopifyテスト認証情報の利用について

ユーザーからShopifyテストアカウントの情報（ドメイン・トークン）が提供された場合：

1. **Code Node A の `SHOPIFY_DOMAIN` / `ACCESS_TOKEN` を差し替え**
2. **Stage 3b の疎通テストを実行**（bash_tool でcurlまたはNode.jsスクリプト）
3. **テスト注文番号が提供されれば、実際の検索フローも検証可能**

これにより、インポート前に「APIが正しく動作するか」を確認でき、
本番運用後のエラーを大幅に削減できる。

### 提供が必要な情報
- `SHOPIFY_DOMAIN`: `xxx.myshopify.com`
- `ACCESS_TOKEN`: `shpat_xxx`
- （オプション）テスト注文番号: `#1001` など

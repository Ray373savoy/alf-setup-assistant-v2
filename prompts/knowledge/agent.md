# Agent Node（エージェントノード）

設定された指示文と知識を基に顧客と対話しながら情報を収集したり問題を解決する「AI思考」段階です。

## 提案書のポリシー案内活用
タスク提案書にポリシー案内メッセージがあれば**そのまま**使用します。
- 提案書のポリシーテーブル → `instruction`の案内メッセージテンプレートに挿入
- 任意に修正せず原文そのまま使用

## 特徴

- **知識（Knowledge）基盤の回答**：顧客企業がアップロードしたドキュメント、アーティクル、Excelファイル等を参照
- **1つのノードで複数のAction可能**：1回の出力で終わらない
- **顧客情報、相談情報、メモリ変数活用可能**

## いつ使う？

- 顧客への情報入力要求
- 知識基盤の案内提供
- 選択肢確認（項目選択、オプション選択等）
- 状況に合ったカスタム案内

## テンプレート

```
## 📝 役割

## 📋 対話フロー

## 💬 案内メッセージ（提案書/FigJamに明示されている場合）

## ⚠️ 例外事項

## ✅ 終了条件
```

**終了条件は常に最後に位置**

## ✅ 終了条件が重要な理由

**現象：** エージェントノードは別途のタイムアウトがないため、終了条件が曖昧だと無限に「Processing」状態のまま残ります。

**原因：**
1. エージェントノードは基本的に**ユーザーのレスポンスを期待**
2. **終了条件の曖昧さ**

**解決方法：**

### 1. 案内メッセージを具体的に明示 → 出力したら終了（推奨）

```markdown
## 💬 案内メッセージ
新規加入者の場合、内規により身分証認証承認された時間から
24時間以内に最大50万ウォン限度1回 / 14日間最大300万ウォン送金可能です。

## ✅ 終了条件
案内メッセージの出力が完了したら終了します。
```

### 2. 質問誘導 → ユーザー応答時に完了（応答が必要な場合）

```markdown
## ✅ 終了条件
インストール方法案内後、必ず以下の質問で締めくくり：
「**インストールを進めて、完了したらお知らせください！**」
顧客が「インストールした」「完了」等で応答したら完了
```

### 3. メモリ保存が終了条件の場合

```markdown
## ✅ 終了条件
<promptdata type="read-variable" subtype="taskMemory" identifier="target_country">target_country</promptdata>の値が保存されたら完了
```

### 4. context.userChat読み取り

```markdown
<promptdata type="read-variable" subtype="userChat" identifier="userChat.profile.deliveryNum">userChat.profile.deliveryNum</promptdata>
```

## Memory読み取り/書き込み

**核心ルール：**
- **終了条件**：必ず`read-variable`（保存有無確認用）
- **対話フロー**：
  - データを読んで出力（list等）：`read-variable`
  - 顧客入力を受けて保存：`update-variable`

| 位置      | 用途                | タグ                    |
|-----------|---------------------|-------------------------|
| 対話フロー | データを読んで出力  | `read-variable`         |
| 対話フロー | 顧客入力 → 保存    | `update-variable`       |
| 終了条件 | 保存有無確認      | `read-variable`（必須） |

**タグ位置：変数名のすぐ横にインラインで（マッピング明確）**
```markdown
- 名前 <promptdata type="update-variable" ...>customer_name</promptdata>に保存
- 電話番号 <promptdata type="update-variable" ...>customer_phone</promptdata>に保存
```

**例：**
```markdown
1. <promptdata type="read-variable" subtype="taskMemory" identifier="actual_name">actual_name</promptdata>を読んで比較
2. パスポート英文名の入力要求 → <promptdata type="update-variable" subtype="taskMemory" identifier="customer_name">customer_name</promptdata>に保存
```

**重要：identifierとcontentは必ず同一でなければなりません。**

```markdown
読み取り: <promptdata type="read-variable" subtype="taskMemory" identifier="key">key</promptdata>
書き込み: <promptdata type="update-variable" subtype="taskMemory" identifier="key">key</promptdata>
```

## 配列データ活用

memoryに保存された配列（例：item_list）を読んでフォーマット/繰り返し出力も可能：

```markdown
1. <promptdata type="read-variable" subtype="taskMemory" identifier="item_list">item_list</promptdata>を読んで以下のフォーマットで出力：
{index}番. {item_id}
{item_name}
{item_dateをyyyy-mm-dd形式で}
```

## 条件別分岐案内

1つのエージェントノードで条件に応じて異なる案内が可能です：

```markdown
## 📋 対話フロー

[分岐：item_count == 1]
単件の照会結果をそのまま案内します。

[分岐：item_count > 1]
複数件があるため一覧を表示し選択を要求します。

[分岐：item_count == 0]
照会結果がないことを案内します。
```

## 実際の例

### ポリシー案内（案内後終了）

```markdown
## 📝 役割
24時間/14日限度制限ポリシー案内

## 📋 対話フロー
- 顧客が使用した言語を検知して同じ言語で応答してください。
- 日本語、英語、ベトナム語、中国語、ネパール語等の多様な言語をサポートします。
- 24時間/14日限度制限が適用された顧客にポリシー内容を案内します。

## 💬 案内メッセージ
新規加入者の場合、内規により身分証認証承認された時間から
24時間以内に最大50万ウォン限度1回 / 14日間最大300万ウォン送金可能です。

## ✅ 終了条件
案内メッセージの出力が完了したら終了します。
```

### 項目選択（顧客応答が必要）

```markdown
## 📝 役割
照会された複数の項目の中から顧客が希望する項目を選択してもらいます。

## 📋 対話フロー
1. <promptdata type="read-variable" subtype="taskMemory" identifier="item_list">item_list</promptdata>を読んで以下のフォーマットで出力してください：
{index}番. {item_id}
{item_name}
{item_dateをyyyy-mm-dd形式で}

2. 顧客が選択した項目を見つけて保存：
   - <promptdata type="update-variable" subtype="taskMemory" identifier="selected_item_id">selected_item_id</promptdata>

## ⚠️ 例外事項
- 顧客は「1番」「最初のやつ」「一番上」等、相対的に言う場合があります。
- index番号を基準にitem_listから該当するitem_idを見つけてください。
- 「名義」の代わりに「情報」で案内します。（例：「お客様の情報で照会される内容があります」）

## ✅ 終了条件
<promptdata type="read-variable" subtype="taskMemory" identifier="selected_item_id">selected_item_id</promptdata>の値が保存されたら完了
```

---

## instruction テンプレートパターン

agentノードの instruction は用途に応じて以下の3パターンから選択し、カスタマイズして使用すること。

### パターン1: 情報収集型

顧客から必要な情報を聞き取り、memory に保存するパターン。

```
## 🎯 目的
顧客から{収集したい情報}を聞き取ります。

## 📋 対話フロー
1. 「{質問文}」と聞いてください。
2. 顧客の回答を以下に保存してください：
   - <promptdata type="update-variable" subtype="taskMemory" identifier="{key1}">{key1}</promptdata>
   - <promptdata type="update-variable" subtype="taskMemory" identifier="{key2}">{key2}</promptdata>

## ⚠️ 注意事項
- 回答が不明確な場合は聞き直してください。
- {バリデーションルール: 例「電話番号は数字のみ」}

## ✅ 終了条件
{key1} と {key2} がともに保存されたら完了
```

### パターン2: 案内型

取得済みの memory データを使って顧客に情報を案内するパターン。

```
## 🎯 目的
注文情報を顧客に案内します。

## 📋 参照データ
- 注文番号: <promptdata type="read-variable" subtype="taskMemory" identifier="shopify_order_name">shopify_order_name</promptdata>
- 配送状況: <promptdata type="read-variable" subtype="taskMemory" identifier="shopify_displayFulfillmentStatus">shopify_displayFulfillmentStatus</promptdata>
- 追跡番号: <promptdata type="read-variable" subtype="taskMemory" identifier="shopify_trackingNumbers">shopify_trackingNumbers</promptdata>

## 📋 対話フロー
1. 上記の情報を使い、以下の形式で案内してください：
   「ご注文 {注文番号} の配送状況は {配送状況} です。追跡番号は {追跡番号} です。」
2. 追跡番号がない場合は「まだ出荷処理が完了していないため、追跡番号は発行されていません。」と案内してください。

## ✅ 終了条件
案内が完了したら完了
```

### パターン3: 確認型

処理内容を顧客に提示し、明確な同意を得るパターン。

```
## 🎯 目的
{処理内容}について顧客の最終確認を取ります。

## 📋 参照データ
- {確認対象}: <promptdata type="read-variable" subtype="taskMemory" identifier="{key}">{key}</promptdata>

## 📋 対話フロー
1. 「{確認対象}について{処理内容}を行います。よろしいですか？」と確認してください。
2. 顧客が同意した場合：
   - <promptdata type="update-variable" subtype="taskMemory" identifier="is_confirmed">is_confirmed</promptdata> に true を保存
3. 顧客が拒否した場合：
   - <promptdata type="update-variable" subtype="taskMemory" identifier="is_confirmed">is_confirmed</promptdata> に false を保存

## ⚠️ 注意事項
- 「はい」「お願いします」「OK」→ 同意と判定
- 「いいえ」「やめます」「キャンセル」→ 拒否と判定
- 曖昧な場合は再度確認してください

## ✅ 終了条件
is_confirmed が true または false に保存されたら完了
```

### instruction の品質チェックリスト

instruction を書いた後、以下を確認すること：

- [ ] `read-variable` の identifier が memorySchema に存在するか
- [ ] `update-variable` の identifier が memorySchema に存在するか
- [ ] 終了条件が明確に定義されているか
- [ ] 顧客の想定回答パターン（正常系・異常系）が網羅されているか
- [ ] 10,000文字以内に収まっているか


# Context（コンテキスト）

相談開始時点で**既に存在するデータ**です。Taskが実行される前にChannel.ioが提供します。

**読み取り専用**：contextは参照のみ可能で、動的に値を保存できません。値の保存が必要な場合はmemoryを使用してください。

## 構成

- `context.user` - 顧客連絡先情報
- `context.userChat` - 現在の相談情報

## context.user

顧客連絡先情報です。

### ビルトイン vs カスタムフィールドの区別法

- `profile.`プレフィックス**なし** → ビルトインフィールド（Channel.ioデフォルト提供）
- `profile.`プレフィックス**あり** → カスタムフィールド（顧客企業が定義）

### ビルトインフィールド

Channel.ioがデフォルトで提供するフィールドです。
**🔴 ビルトインフィールドは `context.user.{field}` で直接アクセスする（`profile.` は付かない）。**

| フィールド | タイプ | 説明 | コードノードでのパス |
|------|------|------|------|
| `member` | boolean | 会員かどうか | `context.user.member` |
| `hasChat` | boolean | 相談有無 | `context.user.hasChat` |
| `tags` | list | 顧客タグ | `context.user.tags` |
| `id` | string | チャネル内部ID | `context.user.id` |
| `memberId` | string | 会員ID | `context.user.memberId` |
| `createdAt` | datetime | 初回アクセス時間 | `context.user.createdAt` |
| `lastSeenAt` | datetime | 最近アクセス時間 | `context.user.lastSeenAt` |
| `sessionsCount` | number | 総セッション数 | `context.user.sessionsCount` |
| `language` | string | 言語 | `context.user.language` |
| `country` | string | 国 | `context.user.country` |

### カスタムフィールド（profile.*）

顧客企業が定義したフィールドです。
**🔴 カスタムフィールドは `context.user.profile.{field}` でアクセスする（`profile.` が付く）。**

| フィールド | タイプ | 説明 | コードノードでのパス |
|------|------|------|------|
| `profile.name` | string | 顧客名（会員のみ） | `context.user.profile.name` |
| `profile.email` | string | 顧客メール（会員のみ） | `context.user.profile.email` |
| `profile.mobileNumber` | string | 顧客電話番号（会員のみ） | `context.user.profile.mobileNumber` |
| `profile.*` | any | その他カスタムフィールド | `context.user.profile.*` |

**参考**：`name`、`mobileNumber`、`email`などのフィールドも実際にはカスタムフィールドです。よく使われるためデフォルトのように感じますが、顧客企業が設定したものです。

### 🔴 よくある間違い: ビルトイン vs カスタムのパス混同

以下のパス指定ミスが頻繁に発生するため、コードノード・ブランチ条件で context を参照する際は必ず確認すること。

```
❌ context.user.profile.memberId   → memberId はビルトイン（user直下）
✅ context.user.memberId

❌ context.user.profile.member     → member はビルトイン（user直下）
✅ context.user.member

❌ context.user.name               → name はカスタム（profile配下）
✅ context.user.profile.name

❌ context.user.mobileNumber       → mobileNumber はカスタム（profile配下）
✅ context.user.profile.mobileNumber
```

### Shopify連携での本人確認パターン

Shopifyと連携している場合、顧客のShopify IDが `memberId`（ビルトイン・user直下）に同期される。
本人確認（注文者と問い合わせユーザーの一致判定）には **`context.user.memberId`** を使用すること。

```javascript
// ✅ 正しい: memberId はビルトイン（user直下）
const shopifyCustomerId = context.user.memberId;

// ❌ 間違い: profile 配下ではない
// const shopifyCustomerId = context.user.profile.customerId;
// const shopifyCustomerId = context.user.profile.memberId;
```

`profile.customerId` はChannel Talk側で企業が独自に定義したカスタムフィールドであり、Shopify連携で自動同期されるフィールドとは異なる。

### 注意：mobileNumber形式

`profile.mobileNumber`は国際形式で保存されます（例：`+821012345678`）。

APIパラメータとして使用する際は整形が必要：

```javascript
const raw_phone = context.user.profile.mobileNumber; // "+821012345678"
const phone_number = raw_phone?.replace(/^\+82/, '0'); // "01012345678"
```

## context.userChat

現在の相談情報です。

| フィールド | タイプ | 説明 |
|------|------|------|
| `state` | string | 相談状態 |
| `tags` | array | 相談タグ一覧 |
| `profile.*` | any | 顧客企業カスタムフィールド |

### カスタムプロフィールフィールド（userChat）

顧客企業が定義したカスタムフィールドも`userChat.profile`で参照できます：

```json
{ "key": "userChat.profile.deliveryNum", "type": "string", ... }
{ "key": "userChat.profile.orderNo", "type": "string", ... }
{ "key": "userChat.profile.deliveryHopeDate", "type": "date", ... }
```

エージェントノードでの読み取り：
```markdown
<promptdata type="read-variable" subtype="userChat" identifier="userChat.profile.deliveryNum">userChat.profile.deliveryNum</promptdata>
```

## 使用箇所

コードノード、エージェントノード、ブランチ条件でmemoryとcontextの両方を使用できます。
メッセージノードはパーソナライズ変数（`#{名前}`）のみ可能で、memory/context変数は使用できません。

### ブランチ条件

```json
{
  "key": "context.user.member",
  "type": "boolean",
  "operator": "$eq",
  "values": [true]
}
```

### コードノード

```javascript
// ビルトイン → user直下
const is_member = context.user.member;
const member_id = context.user.memberId;

// カスタム → profile配下
const customer_name = context.user.profile.name;
const customer_email = context.user.profile.email;
```

### エージェントinstruction

**重要：identifierとcontentは必ず同一でなければなりません。**

```markdown
<promptdata type="read-variable" subtype="context" identifier="user.profile.name">user.profile.name</promptdata>
<promptdata type="read-variable" subtype="userChat" identifier="userChat.profile.deliveryNum">userChat.profile.deliveryNum</promptdata>
```

## 会員/非会員分岐パターン

```
[開始] → [会員かどうか確認]
           ├─ 会員 → context.user.profile活用
           └─ 非会員 → エージェントで情報入力要求 → memoryに保存
```

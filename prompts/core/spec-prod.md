# ChannelTalk ALF Task Specification

Task JSON structure definition.

## 0. Export Structure

Task JSON for editor import/export must follow this top-level structure:

```json
{
  "task": { ... },
  "taskEditorPosition": { ... }
}
```

| Key | Required | Description |
|-----|----------|-------------|
| `task` | O | Task definition object |
| `taskEditorPosition` | O | Editor layout info (required for import) |

> Only these two top-level keys are allowed.

## 1. Task Definition

Top-level object representing a Task flow.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | O | Unique Task ID |
| `channelId` | `string` | O | Channel ID |
| `folderId` | `string` | | Folder ID |
| `name` | `string` | O | Task name (1~50 chars) |
| `icon` | `string` | | Icon URL or identifier |
| `trigger` | `string` | O | Trigger condition (1~5,000 chars) |
| `filter` | `Expression` | | Task-level filter condition |
| `targetMediums` | `[]Medium` | | Target medium list |
| `memorySchema` | `[]MemoryDefinition` | | Memory variable definitions (max 50) |
| `nodes` | `[]TaskNode` | | Node list (max 100) |
| `startNodeId` | `string` | | Start node ID |
| `state` | `enum` | O | State: `draft`, `live`, `paused` |

### Medium

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mediumType` | `string` | O | Medium type (e.g., `native`, `app`) |
| `mediumId` | `string` | | Medium ID (required for app type) |

## 2. MemoryDefinition

Defines memory variables used in the Task.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | `string` | O | Variable key (1~60 chars, must be unique) |
| `type` | `string` | O | Data type |
| `description` | `string` | O | Variable description (max 500 chars) - referenced by LLM |

**Allowed types:**
- `boolean`, `number`, `string`
- `list`, `listOfNumber`
- `date`, `datetime`
- `object`, `listOfObject`

## 3. TaskNode

All nodes share common fields.

### 3.1 Common Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | O | Unique node ID (UUID format recommended, must be unique) |
| `key` | `string` | O | Alphabetic key (A, B, ... AA, AB, must be unique) |
| `name` | `string` | O | Node name (1~50 chars) |
| `type` | `enum` | O | Node type |
| `next` | `Next` | | Next node definition |

**Allowed types:**
- `agent`, `message`, `code`
- `userChatInlineAction`, `function`, `browserAutomation`

### 3.2 Agent Node

Performs LLM-based conversation.

```json
{
  "id": "ce664bad-4aef-47ad-9de9-b5422d1023df",
  "key": "A",
  "name": "Ask for order number",
  "type": "agent",
  "next": { ... },
  "instruction": "Ask the customer for their order number."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `instruction` | `string` | O | Prompt for LLM (1~12,000 chars) |

### 3.3 Message Node

Sends a fixed message.

```json
{
  "id": "...",
  "key": "B",
  "name": "Welcome message",
  "type": "message",
  "next": { ... },
  "message": {
    "blocks": [
      { "type": "text", "value": "Hello!" }
    ],
    "buttons": [],
    "files": []
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `NestedMessage` | O | Message content |

### 3.4 Code Node

Executes JavaScript code.

```json
{
  "id": "...",
  "key": "C",
  "name": "Calculate refund",
  "type": "code",
  "next": { ... },
  "code": "const amount = memory.get('amount');\nmemory.put('refund', amount * 0.9);\nmemory.save();"
}
```

**With error handling (onError):**

```json
{
  "id": "...",
  "key": "C",
  "name": "Fetch order data",
  "type": "code",
  "next": { "type": "goto", "to": "node-success" },
  "onError": { "type": "goto", "to": "node-error-handler" },
  "code": "const axios = require('axios');\nconst response = await axios.get('https://api.example.com/orders');\nmemory.put('orders', response.data);\nmemory.save();"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | `string` | O | JavaScript code to execute (目標: 5,000文字以内) |
| `onError` | `Next` | | Error handler (code node only). Routes to specified node when code throws an error |

> When code throws an error, execution routes to the node specified in `onError`. If `onError` is not defined, the Task ends with an error.

### 3.5 Browser Automation Node

Executes browser automation code.

```json
{
  "id": "...",
  "key": "D",
  "name": "Web scraping",
  "type": "browserAutomation",
  "next": { ... },
  "code": "// Playwright code"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | `string` | O | JavaScript code to execute (目標: 5,000文字以内) |

### 3.6 UserChatInlineAction Node

Performs actions on a chat.

```json
{
  "id": "...",
  "key": "E",
  "name": "Open chat and add tags",
  "type": "userChatInlineAction",
  "next": { ... },
  "actions": [
    { "type": "addUserChatTags", "tags": ["VIP"] },
    { "type": "userChatState", "state": "opened" }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `actions` | `[]UserChatAction` | O | Action list (min=1) |

**Allowed action types:**

| type | Fields | Description |
|------|--------|-------------|
| `userChatPriority` | `priority` | Set priority |
| `teamAssign` | `teamId` | Assign team |
| `teamUnassign` | - | Unassign team |
| `managerAssign` | `assigneeId` | Assign manager |
| `managerUnassign` | - | Unassign manager |
| `inviteFollowers` | `followerIds` | Invite followers |
| `removeFollowers` | `followerIds`, `removeAll` | Remove followers |
| `addUserTags` | `tags` | Add user tags |
| `removeUserTags` | `tags`, `removeAll` | Remove user tags |
| `addUserChatTags` | `tags` | Add chat tags |
| `removeUserChatTags` | `tags`, `removeAll` | Remove chat tags |
| `userChatDescription` | `description` | Set chat description |
| `userChatState` | `state` | Change chat state (`opened`) |

> **Note**: No other actions/nodes can follow `userChatState: "opened"` (Task session ends)

### 3.7 Function Node

Calls an external function.

```json
{
  "id": "...",
  "key": "F",
  "name": "Get order",
  "type": "function",
  "next": { ... },
  "functionType": "app",
  "functionKey": "app-127-getOrder",
  "inputMappings": [
    { "name": "orderId", "type": "string", "sourceKey": "taskMemory.orderId" }
  ],
  "outputMappings": [
    { "propertyPath": "data.status", "type": "string", "targetKey": "taskMemory.orderStatus" }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `functionType` | `string` | O | `app` or `custom` |
| `functionKey` | `string` | O | Function key |
| `inputMappings` | `[]InputMapping` | | Input mappings |
| `outputMappings` | `[]OutputMapping` | | Output mappings |
| `appSystemVersion` | `string` | | Version for app type (default: `v1`) |

#### InputMapping

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | O | Parameter name |
| `type` | `string` | O | Type: `string`, `number`, `boolean`, `list`, `listOfNumber`, `object`, `listOfObject` |
| `sourceKey` | `string` | | Key to get value from (`user.profile.*`, `userChat.profile.*`, `taskMemory.*`) |
| `value` | `string` | | Direct input value |

> Either `sourceKey` or `value` is required

#### OutputMapping

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `propertyPath` | `string` | O | Path in response (e.g., `data.status`) |
| `type` | `string` | O | Type: `string`, `number`, `boolean`, `list`, `listOfNumber`, `object`, `listOfObject` |
| `targetKey` | `string` | O | Key to save to (`user.profile.*`, `userChat.profile.*`, `taskMemory.*`) |

## 4. Next

Defines the next step after node execution.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `enum` | O | `goto`, `branch`, `button` |
| `to` | `string` | | goto: Next node ID or `END_TASK` |
| `conditions` | `[]Condition` | | branch: Condition array |
| `default` | `string` | | branch: Default next node |
| `buttons` | `[]Button` | | button: Button array |

### 4.1 Goto

```json
{
  "type": "goto",
  "to": "node-2"
}
```

### 4.2 Branch

```json
{
  "type": "branch",
  "conditions": [
    {
      "filter": { "and": [{ "or": [{ "key": "taskMemory.hasInfo", "type": "boolean", "operator": "$eq", "values": [true] }] }] },
      "to": "node-3"
    }
  ],
  "default": "node-4"
}
```

### 4.3 Button

```json
{
  "type": "button",
  "buttons": [
    { "id": "btn-1", "name": "Yes", "to": "node-yes" },
    { "id": "btn-2", "name": "No", "to": "node-no" }
  ]
}
```

**Allowed values for `to`:**
- Next node ID
- `"END_TASK"` (End Task)
- `null` (Not connected)

## 5. Expression (Filter)

Structure for defining conditions. Used in Task-level filters and branch conditions.

```json
{
  "and": [
    {
      "or": [
        {
          "key": "taskMemory.orderCount",
          "type": "number",
          "operator": "$gt",
          "values": [0]
        }
      ]
    }
  ]
}
```

### 5.1 Condition Fields

| Field | Type | Description |
|-------|------|-------------|
| `key` | `string` | Variable path (`user.*`, `userChat.*`, `taskMemory.*`) |
| `type` | `string` | `string`, `number`, `boolean`, `list`, `date`, `datetime` |
| `operator` | `string` | Comparison operator |
| `values` | `array` | Comparison values |

### 5.2 Operators

**Basic operators:**

| Operator | Description | Example |
|----------|-------------|---------|
| `$eq` | Equals | `"values": ["completed"]` |
| `$ne` | Not equals | `"values": ["cancelled"]` |
| `$in` | In array | `"values": ["A", "B"]` |
| `$nin` | Not in array | `"values": ["C"]` |
| `$exist` | Exists | `"values": ["true"]` |
| `$nexist` | Does not exist | `"values": ["true"]` |

**Number operators:**

| Operator | Description |
|----------|-------------|
| `$gt` | Greater than (>) |
| `$gte` | Greater than or equal (>=) |
| `$lt` | Less than (<) |
| `$lte` | Less than or equal (<=) |

**String operators:**

| Operator | Description |
|----------|-------------|
| `$startWith` | Starts with |
| `$nStartWith` | Does not start with |

**Date operators:**

| Operator | Description |
|----------|-------------|
| `$eqAgo` | Equals N days ago |
| `$gtAgo` | After N days ago |
| `$ltAgo` | Before N days ago |

**List operators (ANY):**

| Operator | Description |
|----------|-------------|
| `$containsAny` | Contains any |
| `$anyContainsSubstring` | Any contains substring |
| `$anyGte` | Any greater than or equal |
| `$anyLte` | Any less than or equal |
| `$anyStartWith` | Any starts with |

**List operators (ALL):**

| Operator | Description |
|----------|-------------|
| `$containsAll` | Contains all |
| `$setEqual` | Set equals |
| `$allContainsSubstring` | All contain substring |
| `$allGte` | All greater than or equal |
| `$allLte` | All less than or equal |
| `$allStartWith` | All start with |

## 6. TaskEditorPosition

Editor layout information. Not required for execution but needed for editor import.

| Field | Type | Description |
|-------|------|-------------|
| `nodePositions` | `[]NodePosition` | Node position array |
| `edgePositions` | `[]EdgePosition` | Edge array |

### NodePosition

```json
{
  "id": "node-1",
  "position": { "x": 400, "y": 0 }
}
```

### EdgePosition

```json
{
  "sourceNode": { "id": "node-1", "offset": 0, "type": "goto", "index": 0 },
  "targetNode": { "id": "node-2", "offset": 0 }
}
```

> **sourceNode.type values**: `goto`, `branch`, `button`

> ⚠️ **重要**: `onError` は `sourceNode.type` として **使用禁止**。
> Channel Talk エディタのスキーマバリデーションで Invalid enum value エラーになる。
> `onError` フィールドはノード定義（`task.nodes[*].onError`）に記述するが、
> `taskEditorPosition.edgePositions` には **一切含めないこと**。

## 7. Structural Constraints

### 7.1 Reachability

All nodes must be reachable from `startNodeId`.

```
startNodeId: "node-1"

node-1 → node-2 → node-3 → END_TASK
              ↘ node-4 → END_TASK

All nodes reachable from startNodeId ✅
```

- Isolated (unreachable) nodes trigger a warning.
- `startNodeId` must reference an existing node in `nodes`.

### 7.2 Cycle Prevention

Circular node connections are not allowed.

```
node-1 → node-2 → node-3 → node-1  ❌ Cycle detected
```

### 7.3 Valid Destinations

All `next.to`, `conditions[].to`, and `default` values must be:
- An existing node ID in `nodes`, OR
- `"END_TASK"` (terminates the Task), OR
- `null` (not connected)

Self-references are not allowed (`next.to` cannot point to the same node).

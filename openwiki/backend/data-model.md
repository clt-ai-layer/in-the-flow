# Backend: Data Model, Projections, and MongoDB Collections

## Overview

The backend persists state through Emmett event streams in MongoDB and derives read models through inline projections. In addition, it maintains an EAV-style records collection for custom views.

The important distinction is:

- **event streams** are the source of truth
- **inline projections** are read-optimized documents derived from those streams
- **EAV collections** are a secondary indexed representation used by the custom view engine

## MongoDB event-store configuration

File: `backend-js/src/platform/mongoConfig.ts`

### `getMongoClient()`

```ts
async function getMongoClient(): Promise<MongoClient>
```

Creates a shared client lazily and reuses it across requests.

### `tryGetMongoClient()`

```ts
async function tryGetMongoClient(): Promise<MongoClient | null>
```

Used by view routes and integration handlers when the process may be running in a test mode without a live Mongo URI.

### `getEventStore()`

```ts
async function getEventStore(): Promise<MongoDBEventStore>
```

The event store is created with:

- `storage.type = "COLLECTION_PER_STREAM_TYPE"`
- `storage.databaseName = getDatabaseName()`
- `projections = inlineProjections`

That means each entity stream family gets its own Mongo collection rather than a single monolithic event collection.

### `closeMongoResources()`

Closes the cached event store and client during shutdown.

## Stream families

The persisted stream types are defined on the aggregates themselves:

- `Task.streamType = "task"`
- `DailyTask.streamType = "dailyTask"`
- `Project.streamType = "project"`
- `Settings.streamType = "settings"` in the settings domain
- `DatabaseView.streamType = "databaseView"` in the views domain

The code treats these strings as durable persistence identifiers.

## Inline projections

Inline projections are registered in the backend platform layer and are the primary read path for API endpoints.

### Task list projection

File: `backend-js/src/task/projections/taskListProjection.ts`

Projection name: `task_list`

Document shape:

```ts
type TaskListDocument = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  category: string;
  source: string;
  owner: string | null;
  task_grouping: string | null;
  archived: boolean;
  estimated_duration: number | null;
  current_duration: number | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
};
```

Behavior:

- `TaskCreated` writes a full document
- `TaskUpdated` patches the document
- `TaskDeleted` returns `null`, which removes it from the read model

Index spec:

```ts
{ archived: 1, project_id: 1, status: 1, category: 1 }
```

This index shape matches the common filters used by the task API and the UI.

### Daily task projection

File: `backend-js/src/dailyTask/projections/dailyTaskProjection.ts`

Projection name: `daily_task`

Document shape includes both schedule fields and denormalized parent task fields:

- `task_id`
- `date`
- `start_time`
- `end_time`
- `title`
- `owner`
- `parent_task_name`
- `parent_task_grouping`
- `parent_project_id`
- `parent_status`
- `parent_archived`

The parent fields are important because the calendar UI can render linked task context without hitting the task collection again.

Index spec:

```ts
{ date: 1, start_time: 1, task_id: 1 }
```

This supports the main calendar fetch patterns.

### Project projection

File: `backend-js/src/project/projections/projectListProjection.ts`

Projection name: `project_list`

Shape:

```ts
type ProjectListDocument = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
};
```

### Settings projection

File: `backend-js/src/settings/projections/settingsProjection.ts`

Projection name: `settings_map`

Shape: `Record<string, string>`

This is the simplest read model in the system, but it is central to runtime behavior because it stores AI keys, theme preference, planning path, and sync hash metadata.

### Database view projection

File: `backend-js/src/views/projections/databaseViewListProjection.ts`

Projection name: `database_view_list`

Shape:

```ts
type DatabaseViewListDocument = {
  id: string;
  database_id: string;
  name: string;
  layout_type: string;
  filters: Record<string, unknown>;
  sorts: unknown[];
  grouping: Record<string, unknown>;
  visible_properties: string[];
};
```

This projection is the backing store for the custom views sidebar and the query-control UI.

## EAV records collection

The custom view engine reads from a records collection rather than from task/projection documents directly.

### Collection name

Defined in `backend-js/src/views/eavIds.ts` as `DATABASE_RECORDS_COLLECTION`.

### Task records

File: `backend-js/src/views/projections/taskRecordProjection.ts`

Property value shape:

```ts
type TaskRecordPropertyValues = {
  Name: string;
  Description: string;
  Status: string;
  Category: string;
  Source: string;
  Owner: string;
  TaskGrouping: string;
  "Estimated Duration": number;
  "Current Duration": number;
  Project: string[];
  Archived: boolean;
};
```

Important mapping decisions:

- `Description` is normalized to `""` rather than `null`
- `Owner` defaults to `Alice`
- `TaskGrouping` defaults to `General`
- `Project` is stored as a string array so relation-style query logic can treat it as multi-valued
- `Archived` is copied as a boolean

### Project records

File: `backend-js/src/views/projections/projectRecordProjection.ts`

Property values are much smaller:

```ts
type ProjectRecordPropertyValues = {
  Name: string;
  Description: string;
  Color: string;
};
```

### Why the EAV records exist

The query engine needs a database-like abstraction with:

- arbitrary properties
- filters over mixed property types
- grouping by dynamic properties
- formula fields
- rollup stubs

That is easier to express over `property_values` JSON than over the aggregate projections themselves.

## Aggregate-to-record sync

The `TaskIntegrationHandler` and `ProjectIntegrationHandler` are the bridge from event streams to EAV records.

### Task sync

On task events:

- `TaskCreated` → upsert task EAV record
- `TaskUpdated` → reload the task projection and upsert the EAV record
- `TaskDeleted` → delete the EAV record

Also, the handler synchronizes or cascades linked daily tasks when task parent context changes or when a task is deleted.

### Project sync

On `ProjectCreated`:

- upsert project EAV record

This keeps the Projects Workspace available to custom views.

## Important collections implied by the code

Even when the code uses higher-level abstractions, the effective Mongo persistence model includes:

- event-stream collections per stream family
- inline projection collections for task list, daily task, project list, settings map, and view list
- a shared `database_records` collection for EAV records
- schema collections loaded by `databaseSchemaStore` and `databaseRecordsStore`

The exact schema-store collection names are defined in the `backend-js/src/views/storage/` modules and should be checked when modifying the view subsystem.

## Change guidance

- If you change a projection document shape, update the route handlers and any frontend code that reads the affected response shape.
- If you change EAV property names, update the seeded schema, record mappers, and the query engine labels together.
- If you add a new setting key that affects runtime behavior, document it in the settings page and keep it as a string in the projection.
- Keep denormalized parent fields in daily tasks in sync with task integration logic.

## Source references

- `backend-js/src/platform/mongoConfig.ts`
- `backend-js/src/task/projections/taskListProjection.ts`
- `backend-js/src/dailyTask/projections/dailyTaskProjection.ts`
- `backend-js/src/project/projections/projectListProjection.ts`
- `backend-js/src/settings/projections/settingsProjection.ts`
- `backend-js/src/views/projections/databaseViewListProjection.ts`
- `backend-js/src/views/projections/taskRecordProjection.ts`
- `backend-js/src/views/projections/projectRecordProjection.ts`
- `backend-js/src/views/eavIds.ts`

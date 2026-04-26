# TaskFlow Microservices Extension

## High-Level Architecture

```text
Browser
  -> Nginx frontend on :80
  -> API Gateway
     -> /api/auth          -> Auth Service          -> mongo-auth
     -> /api/users         -> User Service          -> mongo-user
     -> /api/tasks         -> Task Service          -> mongo-task
     -> /api/notifications -> Notification Service  -> mongo-notification
     -> /api/analytics     -> Analytics Service     -> mongo-analytics
     -> /api/files         -> File Service          -> mongo-file + MinIO
     -> /api/search        -> Search Service        -> Elasticsearch
     -> /api/comments      -> Comment Service       -> mongo-comment
     -> /api/reminders     -> Reminder Service      -> mongo-reminder

Task Event Adapter observes mongo-task without changing Task Service.
It publishes task.* events to RabbitMQ.

RabbitMQ topic exchange: taskflow.events
  -> Notification Service consumes task/comment/file/reminder events
  -> Analytics Service consumes activity events
  -> Search Service consumes task index events
  -> Reminder Service publishes reminder.due events
```

## Added Services

```text
src/services/notification-service
src/services/analytics-service
src/services/file-service
src/services/search-service
src/services/comment-service
src/services/reminder-service
src/services/task-event-adapter
```

Each new API service has:

- `server.js`
- `package.json`
- `Dockerfile`
- Health endpoint: `GET /health`
- Independent storage

## API Gateway Routes

Existing routes are unchanged:

```text
/api/auth  -> auth-service
/api/users -> user-service
/api/tasks -> task-service
```

New protected routes:

```text
/api/notifications -> notification-service /notifications
/api/analytics     -> analytics-service /analytics
/api/files         -> file-service /files
/api/search        -> search-service /search
/api/comments      -> comment-service /comments
/api/reminders     -> reminder-service /reminders
```

The gateway validates JWTs and forwards:

```text
x-user-id
x-user-email
x-user-role
x-user-name
```

## Endpoint Summary

Notification Service:

```text
GET   /notifications
GET   /notifications/unread
PATCH /notifications/:id/read
POST  /notifications/test-email
```

Analytics Service:

```text
GET /analytics/me/summary
GET /analytics/me/tasks-completed?range=week
GET /analytics/admin/users/productivity
GET /analytics/admin/tasks/overview
```

File Service:

```text
POST   /files/tasks/:taskId
GET    /files/tasks/:taskId
DELETE /files/:fileId
```

Search Service:

```text
GET /search/tasks?q=keyword&status=done&from=2026-04-01&to=2026-04-26
GET /search/suggestions?q=key
```

Comment Service:

```text
POST   /comments/tasks/:taskId
GET    /comments/tasks/:taskId
POST   /comments/:commentId/replies
PATCH  /comments/:commentId
DELETE /comments/:commentId
```

Reminder Service:

```text
POST   /reminders/tasks/:taskId
GET    /reminders/me
PATCH  /reminders/:id
DELETE /reminders/:id
```

## Database Schemas

Notification:

```js
{
  userId,
  type,
  title,
  message,
  channel: 'in_app' | 'email',
  read,
  metadata,
  createdAt,
  updatedAt
}
```

DailyMetric:

```js
{
  userId,
  date,
  tasksCreated,
  tasksUpdated,
  tasksCompleted,
  commentsCreated,
  filesAttached
}
```

Attachment:

```js
{
  taskId,
  uploadedBy,
  filename,
  mimeType,
  size,
  storageKey,
  url
}
```

Search document:

```js
{
  taskId,
  userId,
  title,
  description,
  status,
  priority,
  tags,
  dueDate,
  updatedAt
}
```

Comment:

```js
{
  taskId,
  authorId,
  authorName,
  parentCommentId,
  body,
  mentions,
  deletedAt
}
```

Reminder:

```js
{
  taskId,
  userId,
  remindAt,
  status: 'scheduled' | 'sent' | 'cancelled',
  channel: 'in_app' | 'email',
  message
}
```

## Event Model

Exchange:

```text
taskflow.events
```

Topics:

```text
task.created
task.updated
task.status_changed
task.completed
task.deleted
comment.created
file.attached
reminder.due
```

Envelope:

```json
{
  "eventId": "uuid",
  "eventType": "task.completed",
  "version": 1,
  "occurredAt": "2026-04-26T10:00:00.000Z",
  "actorId": "user-id",
  "data": {}
}
```

## Role-Based Features

- User: own notifications, reminders, files, comments, search, and personal analytics.
- Admin: `/analytics/admin/*` endpoints for user productivity and task overview.
- Gateway auth is still the first authorization boundary.
- Services should treat forwarded identity headers as trusted only when traffic comes from the gateway network path.

## Operations

Recommended monitoring:

```text
Prometheus -> metrics scraping
Grafana    -> dashboards
RabbitMQ UI -> queue health on localhost:15672
MinIO UI     -> object storage console on localhost:9001
ELK/Loki   -> structured logs
```

Logging strategy:

```json
{
  "service": "notification-service",
  "level": "info",
  "requestId": "generated-or-forwarded-id",
  "userId": "user-id",
  "message": "notification created"
}
```

## Run

```powershell
docker compose up --build
```

Application:

```text
http://localhost
```

RabbitMQ management:

```text
http://localhost:15672
```

MinIO console:

```text
http://localhost:9001
```

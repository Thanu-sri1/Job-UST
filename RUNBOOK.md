# TaskFlow — Run & Execution Guide

This guide covers every way to run the TaskFlow application: Docker Compose (recommended), bare Node.js, and Kubernetes.

---

## Prerequisites

| Tool | Required For | Install |
|------|-------------|---------|
| Docker Desktop | Docker Compose run | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Node.js 20+ | Local (no Docker) run | [nodejs.org](https://nodejs.org) |
| kubectl | Kubernetes deploy | [kubernetes.io](https://kubernetes.io/docs/tasks/tools/) |
| MongoDB 7 | Local (no Docker) run | `brew install mongodb-community@7.0` |

Check what you have:

```bash
node --version       # v20+
docker --version     # 24+
docker compose version
kubectl version --client
```

---

## Option 1 — Docker Compose (Recommended)

Starts all 8 containers: frontend, api-gateway, 3 microservices, 3 MongoDB instances, and the seeder.

### Step 1 — Clone and enter the project

```bash
git clone <your-repo-url>
cd ust-project
```

### Step 2 — Create environment files

```bash
for svc in auth-service user-service task-service api-gateway; do
  cp src/services/$svc/.env.example src/services/$svc/.env
done
```

### Step 3 — Set the JWT secret (must match in both files)

Open `src/services/auth-service/.env` and `src/services/api-gateway/.env`.
Set the **same** `JWT_SECRET` value in both:

```env
JWT_SECRET=change_this_to_a_long_random_string_32chars
```

Quick one-liner:

```bash
SECRET="my_super_secret_key_change_this_32c"

sed -i '' "s|your_super_secret_jwt_key_change_in_production|$SECRET|g" \
  src/services/auth-service/.env \
  src/services/api-gateway/.env
```

### Step 4 — Start Docker Desktop

Make sure Docker Desktop is open and running before continuing.

### Step 5 — Build and start all services

```bash
docker compose up --build
```

First build takes **3–5 minutes** (downloading images + building). Subsequent starts take ~30 seconds.

### Step 6 — Wait for the seeder to finish

Watch for this output in the terminal:

```
seeder  | 🌱  TaskFlow Database Seeder
seeder  |    Users:  100
seeder  |    Tasks:  1000 (10 per user)
seeder  | ✅  Connected to all 3 MongoDB databases
seeder  | 🗑️   Cleared existing data
seeder  | 🔐  Password hashed (bcrypt cost 12)
seeder  | 👤  Inserting 100 users... done ✅
seeder  | 👤  Inserting 100 user profiles... done ✅
seeder  | 📋  Inserting 1000 tasks... done ✅
seeder  | 🔑  Login with any seed user:
seeder  |    Email:    aarav.clark0@taskflow.dev  (admin)
seeder  |    Password: Password123  (all users)
seeder exited with code 0
```

### Step 7 — Open the app

| URL | What |
|-----|------|
| `http://localhost` | React frontend |
| `http://localhost:3000/health` | API Gateway health check |
| `http://localhost:3000/api/auth/login` | Auth endpoint (POST) |

### Login credentials (seed data)

```
Email:    aarav.clark0@taskflow.dev    ← admin account
Email:    aiden.anderson1@taskflow.dev ← regular user
Password: Password123                  ← all 100 seed users
```

---

## Docker Compose — Useful Commands

```bash
# Start in background (detached mode)
docker compose up --build -d

# View logs — all services
docker compose logs -f

# View logs — one service
docker compose logs -f auth-service
docker compose logs -f seeder

# Check running containers
docker compose ps

# Stop all (data is preserved in volumes)
docker compose down

# Stop and DELETE all data (fresh start)
docker compose down -v

# Rebuild and restart a single service after code change
docker compose up --build auth-service

# Re-run the seeder only (stack must be running)
docker compose run --rm seeder

# Open a shell inside a running container
docker compose exec auth-service sh
```

---

## Option 2 — Run Without Docker (Bare Node.js)

Use this if you prefer not to use Docker.

### Step 1 — Install MongoDB locally

```bash
# macOS
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0

# Verify
mongosh --eval "db.adminCommand('ping')"
```

### Step 2 — Install dependencies for all services

```bash
cd ust-project

for svc in auth-service user-service task-service api-gateway; do
  echo "Installing $svc..."
  (cd src/services/$svc && npm install)
done

echo "Installing frontend..."
(cd src/frontend && npm install)
```

### Step 3 — Create and configure .env files

```bash
for svc in auth-service user-service task-service api-gateway; do
  cp src/services/$svc/.env.example src/services/$svc/.env
done
```

Edit `src/services/auth-service/.env`:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/auth-db
JWT_SECRET=change_this_to_same_value_as_gateway
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:5173
```

Edit `src/services/api-gateway/.env`:

```env
PORT=3000
JWT_SECRET=change_this_to_same_value_as_auth
AUTH_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3002
TASK_SERVICE_URL=http://localhost:3003
ALLOWED_ORIGINS=http://localhost:5173
```

> **JWT_SECRET must be identical in both files.**

### Step 4 — Seed the database

```bash
cd scripts
npm install
node seed.js
cd ..
```

### Step 5 — Start all 5 processes (5 terminal tabs)

**Tab 1 — Auth Service**
```bash
cd src/services/auth-service
npm run dev
# Running on http://localhost:3001
```

**Tab 2 — User Service**
```bash
cd src/services/user-service
npm run dev
# Running on http://localhost:3002
```

**Tab 3 — Task Service**
```bash
cd src/services/task-service
npm run dev
# Running on http://localhost:3003
```

**Tab 4 — API Gateway**
```bash
cd src/services/api-gateway
npm run dev
# Running on http://localhost:3000
```

**Tab 5 — Frontend**
```bash
cd src/frontend
npm run dev
# Running on http://localhost:5173
```

### Step 6 — Open the app

```
http://localhost:5173
```

---

## Verify Everything is Working

### 1. Gateway health check

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "gateway": "ok",
  "services": [
    { "service": "auth-service", "status": "ok" },
    { "service": "user-service", "status": "ok" },
    { "service": "task-service", "status": "ok" }
  ]
}
```

### 2. Register a new user

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"password123"}' \
  | python3 -m json.tool
```

### 3. Login and get a token

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"aarav.clark0@taskflow.dev","password":"Password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

echo "Token: $TOKEN"
```

### 4. Fetch your tasks

```bash
curl -s http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
```

### 5. Create a task

```bash
curl -s -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My first task","priority":"high","status":"todo"}' \
  | python3 -m json.tool
```

---

## Seed Data Details

The seeder creates **100 users** and **1 000 tasks** across three separate databases.

| Database | Port (Docker) | Collection | Records |
|----------|--------------|------------|---------|
| `auth-db` | `27017` | `users` | 100 |
| `user-db` | `27018` | `userprofiles` | 100 |
| `task-db` | `27019` | `tasks` | 1 000 |

Task distribution per user:
- 10 tasks per user
- Random status: `todo` / `in-progress` / `done`
- Random priority: `low` / `medium` / `high`
- Random due dates within ±60 days
- 1–3 tags per task

### Re-seed (wipe all data and start fresh)

```bash
# Docker
docker compose down -v && docker compose up --build

# Local (no Docker)
cd scripts && node seed.js    # seed.js always clears data before inserting
```

### Connect to MongoDB directly (Docker stack running)

```bash
# auth-db
mongosh mongodb://localhost:27017/auth-db

# user-db
mongosh mongodb://localhost:27018/user-db

# task-db
mongosh mongodb://localhost:27019/task-db

# Quick counts
mongosh mongodb://localhost:27017/auth-db --eval "db.users.countDocuments()"
mongosh mongodb://localhost:27019/task-db --eval "db.tasks.countDocuments()"
```

---

## Option 3 — Kubernetes (Local Cluster)

Use [minikube](https://minikube.sigs.k8s.io/) or [kind](https://kind.sigs.k8s.io/) for local Kubernetes.

### Step 1 — Start a local cluster

```bash
# minikube
minikube start

# OR kind
kind create cluster --name taskflow
```

### Step 2 — Build and load images

```bash
# Build all images
docker build -t taskflow/auth-service:dev   src/services/auth-service/
docker build -t taskflow/user-service:dev   src/services/user-service/
docker build -t taskflow/task-service:dev   src/services/task-service/
docker build -t taskflow/api-gateway:dev    src/services/api-gateway/
docker build -t taskflow/frontend:dev       src/frontend/

# Load into minikube (skip if using a registry)
for img in auth-service user-service task-service api-gateway frontend; do
  minikube image load taskflow/$img:dev
done
```

### Step 3 — Update image names in YAML

Edit all `image: YOUR_REGISTRY/...` lines in `k8s-manifests/dev/` to use `taskflow/<service>:dev`.

### Step 4 — Apply all manifests

```bash
# Namespaces first
kubectl apply -f k8s-manifests/namespaces.yaml

# Persistent storage
kubectl apply -f k8s-manifests/dev/mongo-pv.yaml

# Config
kubectl apply -f k8s-manifests/dev/configmap.yaml

# Secrets (replace values)
kubectl create secret generic app-secrets --namespace=dev \
  --from-literal=JWT_SECRET="my_super_secret_key_change_this_32c" \
  --from-literal=AUTH_MONGODB_URI="mongodb://mongo-auth:27017/auth-db" \
  --from-literal=USER_MONGODB_URI="mongodb://mongo-user:27017/user-db" \
  --from-literal=TASK_MONGODB_URI="mongodb://mongo-task:27017/task-db"

# Databases
kubectl apply -f k8s-manifests/dev/mongo-deployments.yaml

# Wait for MongoDB to be ready
kubectl wait --for=condition=available deployment/mongo-auth -n dev --timeout=120s
kubectl wait --for=condition=available deployment/mongo-user -n dev --timeout=120s
kubectl wait --for=condition=available deployment/mongo-task -n dev --timeout=120s

# Microservices
kubectl apply -f k8s-manifests/dev/auth-service.yaml
kubectl apply -f k8s-manifests/dev/user-service.yaml
kubectl apply -f k8s-manifests/dev/task-service.yaml
kubectl apply -f k8s-manifests/dev/api-gateway.yaml
kubectl apply -f k8s-manifests/dev/frontend.yaml
```

### Step 5 — Verify

```bash
kubectl get all -n dev
kubectl get pvc -n dev
```

### Step 6 — Access the app

```bash
# Port-forward the frontend
kubectl port-forward svc/frontend 8080:80 -n dev &

# Port-forward the gateway
kubectl port-forward svc/api-gateway 3000:3000 -n dev &

# Open
open http://localhost:8080
```

### Cleanup

```bash
kubectl delete namespace dev
kubectl delete namespace prod

# minikube
minikube stop && minikube delete

# kind
kind delete cluster --name taskflow
```

---

## Troubleshooting

### Docker daemon not running

```
Cannot connect to the Docker daemon
```

**Fix:** Open Docker Desktop and wait for it to fully start before running `docker compose up`.

---

### Port already in use

```
Bind for 0.0.0.0:80 failed: port is already allocated
```

**Fix:** Find and stop the conflicting process:

```bash
lsof -i :80      # find process using port 80
lsof -i :3000    # find process using port 3000
kill -9 <PID>
```

---

### JWT errors (401 Unauthorized)

```json
{ "error": "Invalid or expired token" }
```

**Fix:** The `JWT_SECRET` must be **identical** in `auth-service/.env` and `api-gateway/.env`.

```bash
# Check both values match
grep JWT_SECRET src/services/auth-service/.env
grep JWT_SECRET src/services/api-gateway/.env
```

---

### Seeder exits before services are ready

If you see connection errors in seeder logs:

```bash
# Restart the seeder after the stack is healthy
docker compose run --rm seeder
```

---

### MongoDB connection refused (local run)

```
MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017
```

**Fix:** Start MongoDB:

```bash
brew services start mongodb-community@7.0
# or
mongod --dbpath /tmp/mongodb
```

---

### Frontend shows blank page

**Fix:** Clear the browser cache or open in incognito. Then check the gateway is healthy:

```bash
curl http://localhost:3000/health
```

---

## Service Ports Reference

| Service | Local Port | Docker Internal Port |
|---------|-----------|---------------------|
| Frontend | `80` | `8080` (nginx-unprivileged) |
| API Gateway | `3000` | `3000` |
| Auth Service | `3001` | `3001` |
| User Service | `3002` | `3002` |
| Task Service | `3003` | `3003` |
| MongoDB (auth) | `27017` | `27017` |
| MongoDB (user) | `27018` | `27017` |
| MongoDB (task) | `27019` | `27017` |

---

## CI/CD Pipeline Triggers

| Action | Branch | Result |
|--------|--------|--------|
| `git push origin develop` | `develop` | Lint → SAST → Scan → Build → Deploy to **dev** namespace |
| `git push origin main` | `main` | Lint → SAST → Scan → Build → Deploy to **prod** namespace |
| Pull request | any | Lint + SAST only (no deploy) |

Required GitHub Secrets before pipeline runs:

```
KUBECONFIG_DEV       base64-encoded kubeconfig for dev cluster
KUBECONFIG_PROD      base64-encoded kubeconfig for prod cluster
JWT_SECRET           shared signing secret
AUTH_MONGODB_URI_DEV
USER_MONGODB_URI_DEV
TASK_MONGODB_URI_DEV
AUTH_MONGODB_URI_PROD
USER_MONGODB_URI_PROD
TASK_MONGODB_URI_PROD
```

Encode your kubeconfig:

```bash
base64 -w0 ~/.kube/config    # Linux
base64 -i ~/.kube/config     # macOS
```

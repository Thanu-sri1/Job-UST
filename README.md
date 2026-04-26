# TaskFlow — Capstone: CI/CD Pipeline with DevSecOps

A production-ready, full-stack microservices application demonstrating a complete DevSecOps lifecycle: multi-branch CI/CD, SAST scanning, container scanning, secret detection, Kubernetes orchestration with PV/PVC, and multi-environment deployment.

---

## Architecture

```
Browser
  └── Frontend (React + Vite + Tailwind CSS — non-root nginx:8080)
        └── /api/* → API Gateway (Express :3000)
                     ├── /api/auth  → Auth Service   (:3001) → MongoDB auth-db (PVC)
                     ├── /api/users → User Service   (:3002) → MongoDB user-db (PVC)
                     └── /api/tasks → Task Service   (:3003) → MongoDB task-db (PVC)
```

### Why this architecture?
Each service owns its database — no shared state. The API Gateway handles JWT verification once so downstream services stay simple. Three separate MongoDB instances (one per service) are provisioned with their own PVCs, ensuring data isolation between logical domains.

---

## Project Structure

```
taskflow/
├── src/                          # All application source code
│   ├── frontend/                 # React SPA (Vite + Tailwind)
│   │   ├── src/
│   │   │   ├── api/axios.js      # Axios client with JWT interceptor
│   │   │   ├── context/AuthContext.jsx
│   │   │   ├── pages/            # Login, Register, Dashboard
│   │   │   └── components/       # TaskCard, TaskModal
│   │   ├── Dockerfile            # Multi-stage, non-root (nginx-unprivileged)
│   │   └── nginx.conf            # SPA routing + security headers (port 8080)
│   └── services/
│       ├── api-gateway/          # JWT auth middleware + http-proxy routing
│       ├── auth-service/         # Register, Login, Token verify + bcrypt
│       ├── user-service/         # Profile CRUD (admin-gated list/delete)
│       └── task-service/         # Task CRUD + stats aggregation
├── k8s-manifests/
│   ├── namespaces.yaml           # dev + prod namespaces
│   ├── dev/
│   │   ├── configmap.yaml        # Non-sensitive env config
│   │   ├── secrets.yaml          # Template only — real values injected by CI
│   │   ├── mongo-pv.yaml         # PersistentVolume + PVC (3 × MongoDB)
│   │   ├── mongo-deployments.yaml
│   │   ├── auth-service.yaml
│   │   ├── user-service.yaml
│   │   ├── task-service.yaml
│   │   ├── api-gateway.yaml
│   │   └── frontend.yaml         # Ingress on taskflow.dev.local
│   └── prod/
│       ├── configmap.yaml        # Prod-specific settings (1d JWT, HTTPS origin)
│       ├── secrets.yaml          # Template — real values injected by CI
│       ├── mongo-pv.yaml         # PV + PVC (10Gi, Retain policy)
│       └── deployments.yaml      # 2 replicas, RollingUpdate, TLS Ingress
├── .github/workflows/
│   ├── dev.yml                   # develop → dev namespace
│   └── prod.yml                  # main → prod namespace
├── docker-compose.yml            # Full local stack (all services + 3 × MongoDB)
└── README.md
```

---

## CI/CD Pipeline

### Branch Strategy

| Branch | Workflow | Target | Trivy exit-code |
|--------|----------|--------|-----------------|
| `develop` | `dev.yml` | `dev` namespace | 0 (warn only) |
| `main` | `prod.yml` | `prod` namespace | 1 (fails pipeline) |

### Pipeline Stages (both workflows)

```
1. Lint          — ESLint on all 4 backend services + frontend build verification
2. CodeQL SAST   — GitHub Advanced Security: security-extended + security-and-quality queries
3. Gitleaks      — Scans full git history for hardcoded secrets / API keys
4. Trivy FS      — Filesystem scan for HIGH/CRITICAL CVEs (SARIF → GitHub Security tab)
5. Build & Push  — Multi-stage Docker build → GHCR (tagged :dev-<sha> or :<sha>)
6. Trivy Image   — Per-image OS-level vulnerability scan (SARIF uploaded)
7. Deploy        — kubectl apply PV/PVC + ConfigMap + Secrets + Deployments → rollout wait
```

### Pipeline Triggers

```bash
git push origin develop   # triggers dev.yml → deploys to k8s namespace: dev
git push origin main      # triggers prod.yml → deploys to k8s namespace: prod
```

---

## Secret Management

Secrets are **never committed** to the repository.

| Secret | Where it lives | How it reaches the pod |
|--------|---------------|------------------------|
| `JWT_SECRET` | GitHub Secrets | `kubectl create secret` in pipeline → K8s Secret → `secretKeyRef` |
| `*_MONGODB_URI` | GitHub Secrets | Same path |
| `KUBECONFIG_*` | GitHub Secrets | `base64 -d` into `~/.kube/config` at deploy time |

The `k8s-manifests/*/secrets.yaml` files are **templates only** — they contain placeholder values and serve as documentation of the expected secret shape. Real values are always injected by the CI pipeline via:

```bash
kubectl create secret generic app-secrets \
  --from-literal=JWT_SECRET="${{ secrets.JWT_SECRET }}" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Connection Verification

```bash
# Verify secrets exist in cluster (values are base64-encoded, not plaintext)
kubectl get secret app-secrets -n dev -o yaml

# Test auth service can reach MongoDB (exec into pod)
kubectl exec -it deploy/auth-service -n dev -- \
  node -e "const m=require('mongoose'); m.connect(process.env.MONGODB_URI).then(()=>console.log('OK')).catch(console.error)"

# Test end-to-end connectivity through gateway
kubectl port-forward svc/api-gateway 3000:3000 -n dev &
curl -s http://localhost:3000/health | jq .
```

---

## Quick Start (Local — Docker Compose)

### Prerequisites
- Docker + Docker Compose
- MongoDB is fully managed by Compose (no local install needed)

```bash
# 1. Copy env files
for svc in auth-service user-service task-service api-gateway; do
  cp src/services/$svc/.env.example src/services/$svc/.env
done

# 2. Set consistent JWT_SECRET in auth-service and api-gateway .env files
#    (they must match — auth service signs tokens, gateway verifies them)
JWT_SECRET="dev_secret_min_32_chars_change_me"
sed -i "" "s/your_super_secret_jwt_key_change_in_production/$JWT_SECRET/" \
  src/services/auth-service/.env src/services/api-gateway/.env

# 3. Start everything
docker compose up --build

# App → http://localhost
# Gateway → http://localhost:3000
# Gateway health → http://localhost:3000/health
```

---

## Quick Start (Local — Without Docker)

### Prerequisites: Node.js 20+, MongoDB running on localhost:27017

```bash
# Install all dependencies
for svc in auth-service user-service task-service api-gateway; do
  (cd src/services/$svc && npm install)
done
(cd src/frontend && npm install)

# Configure env (update JWT_SECRET to be identical in both files)
for svc in auth-service user-service task-service api-gateway; do
  cp src/services/$svc/.env.example src/services/$svc/.env
done

# Start services (open 5 terminal tabs)
# Tab 1: cd src/services/auth-service && npm run dev
# Tab 2: cd src/services/user-service && npm run dev
# Tab 3: cd src/services/task-service && npm run dev
# Tab 4: cd src/services/api-gateway && npm run dev
# Tab 5: cd src/frontend && npm run dev

# Open http://localhost:5173
```

---

## Kubernetes Deployment

### Prerequisites
- `kubectl` connected to your cluster
- Container registry with images built and pushed

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `KUBECONFIG_DEV` | `base64 -w0 ~/.kube/config` — dev cluster |
| `KUBECONFIG_PROD` | `base64 -w0 ~/.kube/config` — prod cluster |
| `JWT_SECRET` | Min 32-char random string |
| `AUTH_MONGODB_URI_DEV` | `mongodb://mongo-auth:27017/auth-db` (or Atlas URI) |
| `USER_MONGODB_URI_DEV` | `mongodb://mongo-user:27017/user-db` |
| `TASK_MONGODB_URI_DEV` | `mongodb://mongo-task:27017/task-db` |
| `AUTH_MONGODB_URI_PROD` | Production Atlas URI |
| `USER_MONGODB_URI_PROD` | Production Atlas URI |
| `TASK_MONGODB_URI_PROD` | Production Atlas URI |

### Manual Deploy (dev)

```bash
# 1. Create namespaces
kubectl apply -f k8s-manifests/namespaces.yaml

# 2. PV/PVC — creates persistent storage for MongoDB
kubectl apply -f k8s-manifests/dev/mongo-pv.yaml

# 3. ConfigMap
kubectl apply -f k8s-manifests/dev/configmap.yaml

# 4. Secrets (replace values)
kubectl create secret generic app-secrets --namespace=dev \
  --from-literal=JWT_SECRET="your_secret" \
  --from-literal=AUTH_MONGODB_URI="mongodb://mongo-auth:27017/auth-db" \
  --from-literal=USER_MONGODB_URI="mongodb://mongo-user:27017/user-db" \
  --from-literal=TASK_MONGODB_URI="mongodb://mongo-task:27017/task-db"

# 5. Deploy everything
kubectl apply -f k8s-manifests/dev/mongo-deployments.yaml
kubectl apply -f k8s-manifests/dev/auth-service.yaml
kubectl apply -f k8s-manifests/dev/user-service.yaml
kubectl apply -f k8s-manifests/dev/task-service.yaml
kubectl apply -f k8s-manifests/dev/api-gateway.yaml
kubectl apply -f k8s-manifests/dev/frontend.yaml

# 6. Verify
kubectl get all -n dev
kubectl get pvc -n dev
```

---

## API Reference

### Auth (`/api/auth`) — no JWT required

| Method | Path | Body |
|--------|------|------|
| POST | `/api/auth/register` | `{name, email, password}` |
| POST | `/api/auth/login` | `{email, password}` |
| GET | `/api/auth/verify` | — (Bearer token in header) |

### Users (`/api/users`) — JWT required

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/users/profile` | Own profile |
| PUT | `/api/users/profile` | Update own profile |
| GET | `/api/users` | Admin only |
| DELETE | `/api/users/:id` | Admin only |

### Tasks (`/api/tasks`) — JWT required

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/tasks` | `?status=&priority=&page=&limit=` |
| GET | `/api/tasks/stats` | Count by status |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |

---

## Security Design

| Control | Implementation |
|---------|---------------|
| SAST | CodeQL with `security-extended` queries (GitHub Advanced Security) |
| Secret detection | Gitleaks scans full git history on every push |
| Container CVE scan | Trivy scans both filesystem and built images; SARIF uploaded to Security tab |
| Password hashing | bcrypt with cost factor 12 |
| Token signing | JWT (HS256) with configurable expiry; 7d dev / 1d prod |
| Non-root containers | Backend: uid 1001. Frontend: uid 101 (nginx-unprivileged) |
| Secret injection | GitHub Secrets → `kubectl create secret` — never committed to repo |
| Rate limiting | 100 req/15 min on auth routes |
| HTTP hardening | Helmet.js (CSP, HSTS, X-Frame-Options, etc.) |
| Network isolation | Services on internal Docker network; only gateway + frontend exposed |
| DB isolation | Three separate MongoDB instances, each with its own PVC |

---

## Proof of Deployment Checklist

After deploying, collect these screenshots/outputs for your submission:

```bash
# 1. All resources in prod namespace
kubectl get all -n prod

# 2. PVC bound (data persistence confirmed)
kubectl get pvc -n prod

# 3. Secrets exist (not exposed)
kubectl get secret app-secrets -n prod

# 4. Pod logs (health)
kubectl logs deploy/auth-service -n prod --tail=20

# 5. Ingress
kubectl get ingress -n prod
```

GitHub Actions screenshots needed:
- Lint job passing
- CodeQL SAST results in Security tab
- Gitleaks scan passing
- Trivy SARIF visible in GitHub Security → Code scanning alerts
- Image build and push succeeding
- Rollout completing (`kubectl rollout status`)
- UI running in both dev (`taskflow.dev.local`) and prod (`taskflow.example.com`)

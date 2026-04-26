# # ── Stage 1: Build ──────────────────────────────────────────────────────────
# FROM node:20-alpine AS build
# WORKDIR /app
# COPY package*.json ./
# RUN npm ci
# COPY . .
# RUN npm run build

# # ── Stage 2: Serve (non-root nginx) ─────────────────────────────────────────
# # nginxinc/nginx-unprivileged runs as uid 101 — never root
# FROM nginxinc/nginx-unprivileged:alpine
# COPY --from=build /app/dist /usr/share/nginx/html
# COPY nginx.conf /etc/nginx/conf.d/default.conf
# EXPOSE 8080
# HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
#   CMD wget -qO- http://localhost:8080/health || exit 1
# CMD ["nginx", "-g", "daemon off;"]

#----------- BUILD STAGE -----------
FROM node:20-alpine AS builder
 
WORKDIR /app
 
COPY package*.json ./
RUN npm install
 
COPY . .
 
RUN npm run build
 
# ----------- RUN STAGE -----------
FROM nginx:alpine
 
# Remove default nginx config
RUN rm -rf /usr/share/nginx/html/*
 
# Copy build files
COPY --from=builder /app/dist /usr/share/nginx/html
 
# Copy custom nginx config (optional)
# COPY nginx.conf /etc/nginx/nginx.conf
 
# Non-root user (nginx already runs non-root internally in alpine)
 
EXPOSE 80
 
CMD ["nginx", "-g", "daemon off;"]
 
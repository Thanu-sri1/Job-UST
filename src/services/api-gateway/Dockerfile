# FROM node:20-alpine AS base
# WORKDIR /app
# COPY package*.json ./
# RUN npm ci --only=production && npm cache clean --force

# FROM node:20-alpine
# WORKDIR /app
# RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001
# COPY --from=base /app/node_modules ./node_modules
# COPY --chown=nodeuser:nodejs . .
# USER nodeuser
# EXPOSE 3000
# HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
#   CMD wget -qO- http://localhost:3000/health || exit 1
# CMD ["node", "server.js"]

# -------- BUILD STAGE --------
FROM node:20-alpine AS builder
 
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
 
# -------- RUN STAGE --------
FROM node:20-alpine
 
WORKDIR /app
 
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
 
COPY --from=builder /app /app
RUN chown -R appuser:appgroup /app
 
USER appuser
 
EXPOSE 3000
CMD ["node", "src/index.js"]
 
# Multi-stage build for the patchbay web app.
#
#   docker build -t patchbay-web .
#   docker run --rm -p 3400:3400 \
#     -e NEBIUS_API_KEY=... -e NEBIUS_AI_PROJECT=... -e TAVILY_API_KEY=... \
#     -e PATCHBAY_MOCK=false \
#     patchbay-web
#
# Or just `docker compose up` from the repo root — docker-compose.yml wires the
# env vars through from a local .env.local.

############################
# 1. Install workspaces + build @patchbay/agent so apps/web can resolve it.
############################
FROM node:22-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/agent/package.json packages/agent/
COPY packages/mcp/package.json packages/mcp/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund --ignore-scripts

############################
# 2. Build the Next.js app in standalone mode.
############################
FROM node:22-slim AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages/agent/node_modules ./packages/agent/node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY . .
# Build the agent first so Next's typecheck + webpack can resolve its dist/ output.
RUN npm run build -w @patchbay/agent
RUN npm run build -w @patchbay/web

############################
# 3. Minimal runtime image — only the standalone server, static assets and public dir.
############################
FROM node:22-slim AS runner
ENV NODE_ENV=production
ENV PORT=3400
ENV HOSTNAME=0.0.0.0
WORKDIR /app
# standalone copies the production node_modules alongside server.js
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
# The connector preflight check calls esbuild at runtime; standalone brings it along.
EXPOSE 3400
CMD ["node", "apps/web/server.js"]

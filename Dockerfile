# Dockerfile for @patchbay-nebius/mcp — stdio MCP server.
#
# Built by Glama (https://glama.ai/mcp) and the Docker MCP Registry.
# Installs the published npm package so the image does not depend on the
# monorepo build and stays reproducible by version.
#
# Usage:
#   docker build -t patchbay-mcp .
#   docker run --rm -i patchbay-mcp
#
# The server speaks MCP over stdio. Hosts (Claude Code, Codex, Cursor,
# Glama's introspection crawler) launch the container with stdin/stdout
# attached and send initialize + tools/list.

FROM node:20-alpine

LABEL org.opencontainers.image.title="patchbay-mcp"
LABEL org.opencontainers.image.description="MCP server that audits any remote MCP server for OAuth 2.1 and security gaps."
LABEL org.opencontainers.image.source="https://github.com/GodSmasher/patchbay"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://patchbay-mcp.dev"

ENV NODE_ENV=production

RUN addgroup -S patchbay && adduser -S patchbay -G patchbay

WORKDIR /app

RUN npm install --omit=dev --no-fund --no-audit @patchbay-nebius/mcp@0.3.2 \
 && npm cache clean --force \
 && chown -R patchbay:patchbay /app

USER patchbay

# Introspection smoke test: `patchbay-mcp --help` would need stdin, so we
# verify the binary resolved instead. Glama launches the container with
# stdin attached and runs the MCP handshake itself.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('@patchbay-nebius/mcp/package.json')" || exit 1

ENTRYPOINT ["node", "/app/node_modules/@patchbay-nebius/mcp/dist/server.js"]

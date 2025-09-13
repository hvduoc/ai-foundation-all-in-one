# Repo rules

- Kiến trúc: Fastify + Redis Cloud (Upstash, TLS `rediss://`) với **Redis singleton**; không connect/quit trong handler.
- Cấu hình Redis: đọc `REDIS_URL`, `KEY_PREFIX`, `USER_CACHE_TTL`; TTL mặc định 300–600s; header `X-Cache: HIT|MISS|BYPASS`.
- Không retry/queue khi sự cố: `enableOfflineQueue=false`, `maxRetriesPerRequest=1`, `retryStrategy=()=>null`, `reconnectOnError=()=>false`.
- Key-namespacing: `KEY_PREFIX={project}:{env}:` để cô lập dữ liệu khi dùng chung 1 Redis.
- Tests: `node:test` + `ioredis-mock`; **không** gọi Upstash trong unit/integration.
- Observability: `/__alive`, `/__diag`, `/__redis` (PING). Log Pino, redact secrets.
- Pull Request: đính kèm Issue, checklist, mô tả tác động & plan Workspace; CI xanh là điều kiện merge.

## Acceptance
- File tồn tại `.github/copilot-instructions.md`. Commit theo Conventional Commits.

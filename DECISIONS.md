# Decisions Log

Decisions made during autonomous development sessions.

## Item 2: PostgreSQL

- **Decision**: No SQLite fallback for local dev. PostgreSQL is the only supported database.
- **Reason**: The project already uses PostgreSQL-specific features (`String[]` array type for `gameIds` in Tournament model, `@prisma/adapter-pg` driver adapter). Supporting SQLite would require maintaining two schemas and losing PostgreSQL features. Local dev should use a Docker PostgreSQL container or a local install — both are trivial to set up.
- **Impact**: Developers need PostgreSQL locally. Added Docker one-liner to the migration guide for easy setup.

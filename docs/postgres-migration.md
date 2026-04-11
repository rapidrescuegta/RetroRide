# PostgreSQL Migration Guide

GameBuddi uses **PostgreSQL** as its production database via Prisma ORM with the `@prisma/adapter-pg` driver adapter for connection pooling.

## Architecture

- **ORM**: Prisma 7 with `prisma-client` generator
- **Driver**: `@prisma/adapter-pg` (native PostgreSQL driver with connection pooling)
- **Connection pooling**: Built into `src/lib/db.ts` with configurable pool size and timeout
- **Migrations**: Managed via `prisma migrate`

## Local Development Setup

### 1. Install PostgreSQL

```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Docker (recommended for quick setup)
docker run -d --name gamebuddi-db \
  -e POSTGRES_USER=gamebuddi_user \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=gamebuddi \
  -p 5432:5432 \
  postgres:15
```

### 2. Create the database

```bash
# If not using Docker:
createdb gamebuddi
createuser gamebuddi_user
psql -c "ALTER USER gamebuddi_user WITH PASSWORD 'devpassword';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE gamebuddi TO gamebuddi_user;"
```

### 3. Configure environment

```bash
cp .env.example .env
```

Set `DATABASE_URL` in `.env`:
```
DATABASE_URL="postgresql://gamebuddi_user:devpassword@localhost:5432/gamebuddi"
```

### 4. Run migrations

```bash
# Apply all migrations
npm run db:migrate:deploy

# Or for development (creates migration files)
npm run db:migrate

# Seed with sample data
npm run db:seed
```

## Production Deployment (Railway)

Railway automatically provisions PostgreSQL and injects `DATABASE_URL`. No manual configuration needed.

For other platforms:

1. Provision a PostgreSQL 15+ instance
2. Set `DATABASE_URL` to the connection string
3. Run `npx prisma migrate deploy` during the build/release phase

## Connection Pool Tuning

The pool is configured in `src/lib/db.ts`. Override defaults with env vars:

| Variable | Default (dev) | Default (prod) | Description |
|---|---|---|---|
| `DATABASE_POOL_SIZE` | 5 | 10 | Max connections in pool |
| `DATABASE_POOL_TIMEOUT` | 10 | 10 | Seconds to wait for a connection |

## Creating New Migrations

```bash
# After modifying prisma/schema.prisma:
npm run db:migrate

# This creates a new migration file in prisma/migrations/
# Review the SQL, then commit both the schema and migration files
```

## Useful Commands

```bash
npm run db:generate    # Regenerate Prisma client after schema changes
npm run db:push        # Push schema changes without creating a migration (dev only)
npm run db:studio      # Open Prisma Studio GUI
npm run db:seed        # Seed database with sample data
npm run db:setup       # Run the full setup script
```

## Troubleshooting

**Connection refused**: Ensure PostgreSQL is running and the connection string is correct.

**Permission denied**: Make sure the database user has the right privileges:
```sql
GRANT ALL PRIVILEGES ON DATABASE gamebuddi TO gamebuddi_user;
GRANT ALL ON SCHEMA public TO gamebuddi_user;
```

**Migration drift**: If the database is out of sync:
```bash
npx prisma migrate resolve --applied <migration_name>
```

**Reset everything** (dev only):
```bash
npx prisma migrate reset
```

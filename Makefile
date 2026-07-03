# ─── Trade Analyser AI — Developer Shortcuts ─────────────────────────────────
# Usage: make <target>
# Requires: Docker Desktop, Node.js 20+, Python 3.11+

.PHONY: help up down logs ps build \
        db-migrate db-generate db-studio db-push \
        node-dev python-dev frontend-dev \
        install seed seed-theory clean

# Default
help:
	@echo ""
	@echo "  Trade Analyser AI — Makefile"
	@echo ""
	@echo "  Docker (full stack):"
	@echo "    make up           Start all services (docker compose up -d)"
	@echo "    make down         Stop all services"
	@echo "    make logs         Tail logs from all containers"
	@echo "    make ps           Show container status"
	@echo "    make build        Rebuild all images"
	@echo ""
	@echo "  Database:"
	@echo "    make db-push      Push Prisma schema to DB (dev, no migration files)"
	@echo "    make db-migrate   Run Prisma migrate dev (creates migration)"
	@echo "    make db-generate  Regenerate Prisma client"
	@echo "    make db-studio    Open Prisma Studio"
	@echo "    make seed         Run DB seed script"
	@echo "    make seed-theory  Embed built-in trading theory into pgvector (run once after deploy)"
	@echo ""
	@echo "  Local dev (without Docker):"
	@echo "    make install      npm ci in all JS dirs"
	@echo "    make node-dev     Run Node.js backend locally"
	@echo "    make python-dev   Run Python FastAPI locally"
	@echo "    make frontend-dev Run Next.js dev server"
	@echo ""
	@echo "  Cleanup:"
	@echo "    make clean        Remove containers, volumes, and node_modules"
	@echo ""

# ─── Docker ──────────────────────────────────────────────────────────────────

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

build:
	docker compose build --no-cache

# ─── Database (run inside backend-node dir) ───────────────────────────────────

db-push:
	cd backend-node && npx prisma db push

db-migrate:
	cd backend-node && npx prisma migrate dev

db-generate:
	cd backend-node && npx prisma generate

db-studio:
	cd backend-node && npx prisma studio

seed:
	cd backend-node && npx tsx prisma/seed.ts

seed-theory:
	curl -s -X POST http://localhost:8000/ai/documents/seed-builtin \
	  -H "X-Internal-Secret: $$(grep JWT_SECRET .env | cut -d= -f2)" \
	  | python3 -m json.tool

# ─── Local dev ───────────────────────────────────────────────────────────────

install:
	cd backend-node && npm ci
	cd frontend && npm ci

node-dev:
	cd backend-node && npm run dev

python-dev:
	cd backend-python && uvicorn app.main:app --reload --port 8000

frontend-dev:
	cd frontend && npm run dev

# ─── Cleanup ─────────────────────────────────────────────────────────────────

clean:
	docker compose down -v --remove-orphans
	rm -rf backend-node/node_modules frontend/node_modules
	@echo "Cleaned containers, volumes, and node_modules"

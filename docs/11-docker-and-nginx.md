# Module 11 — Docker & Nginx Basics

Two tools you'll bump into any time you work with production-shaped software.
This module covers the essentials — no deep dive, just enough to be
productive with our setup.

## Docker in one paragraph

Docker packages an application plus everything it needs (OS libraries,
runtime, config) into a single **image**. When you run that image, you get a
**container** — a lightweight isolated process. Two teammates can run the
exact same container and get bit-identical behaviour, unlike "works on my
machine" chaos.

Think of images as **classes** and containers as **instances**.

## Docker commands you'll use daily

| Command | What it does |
|---|---|
| `docker ps` | List running containers. |
| `docker ps -a` | List all containers (including stopped). |
| `docker logs <name>` | Print recent stdout of a container. |
| `docker logs -f <name>` | Follow logs live (like `tail -f`). |
| `docker exec -it <name> bash` | Open a shell inside a running container. |
| `docker stop <name>` | Stop a running container. |
| `docker restart <name>` | Restart it. |
| `docker rm <name>` | Delete a stopped container. |
| `docker image ls` | List downloaded images. |
| `docker system prune` | Free disk by deleting stopped containers + unused images. |

## Docker Compose — orchestrating multiple containers

Real apps have many pieces (Postgres, Mongo, Node, Python, Nginx). Managing
them one-by-one is tedious. **Docker Compose** reads a single YAML file and
runs them all together, wired to a shared network.

Open `docker-compose.yml` in the project root. It has **five** services:

```yaml
services:
  postgres:       # database with pgvector
  mongodb:        # chat history
  backend-node:   # Express API
  backend-python: # FastAPI service
  frontend:       # Next.js
  nginx:          # reverse proxy
```

### Reading a service block

```yaml
postgres:
  image: pgvector/pgvector:pg15         # ← image to pull from Docker Hub
  container_name: trade_postgres        # ← human-readable name
  restart: unless-stopped               # ← auto-restart on crash
  environment:                          # ← env vars inside the container
    POSTGRES_USER: ${POSTGRES_USER:-postgres}    # from your .env or default
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-trade_pass}
    POSTGRES_DB: ${POSTGRES_DB:-trade_analyser}
  ports:                                # ← host:container
    - "5433:5432"                       # host 5433 → container's 5432
  volumes:                              # ← persistent storage
    - postgres_data:/var/lib/postgresql/data
    - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
  healthcheck:                          # ← how Docker knows it's ready
    test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres} ..."]
    interval: 10s
    timeout: 5s
    retries: 5
```

Key things:

- **`image`** — the OS + software layer, pulled once and cached. For most
  services (postgres, mongodb, nginx) this is a public image on Docker Hub.
- **`build`** — used instead of `image` for services we compile ourselves
  (backend-node, backend-python, frontend). Points to a Dockerfile.
- **`ports: "5433:5432"`** — host port 5433 maps to container port 5432.
  That's why our DB URLs say `localhost:5433`.
- **`volumes`** — the container's filesystem is disposable. Volumes let data
  survive `docker restart`. Two types:
  - **Named volume** (`postgres_data:/var/lib/...`) — Docker manages storage.
  - **Bind mount** (`./docker/postgres/init.sql:...`) — mount a specific
    file/folder from your host into the container.
- **`depends_on`** — start-order rules. `backend-node` waits until `postgres`
  and `mongodb` report healthy.

### Compose commands

| Command | What it does |
|---|---|
| `docker compose up -d` | Start every service (detached). |
| `docker compose up -d postgres mongodb` | Start only specific services. |
| `docker compose down` | Stop and remove containers (keeps volumes). |
| `docker compose down -v` | Stop and remove containers **and** volumes (destroys data). |
| `docker compose ps` | Status of all services. |
| `docker compose logs -f backend-python` | Follow logs of one service. |
| `docker compose restart backend-python` | Restart one service. |
| `docker compose build` | Rebuild all custom images. |
| `docker compose exec postgres psql -U postgres` | Open psql inside the postgres container. |

## Dockerfile in one paragraph

A **Dockerfile** is a recipe for building an image. Peek at
`docker/Dockerfile.python`:

```dockerfile
FROM python:3.12-slim               # base OS + Python
WORKDIR /app                        # cd into /app for the rest

COPY requirements.txt .             # copy req file first (caching!)
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app                      # then copy code

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Why copy requirements first, then code? Docker caches each layer. If your
code changes but requirements.txt doesn't, the pip layer is reused — you
don't reinstall from scratch. Layer ordering is the #1 Dockerfile
optimisation.

## Why we use Docker in dev

- Postgres with pgvector: painful to install natively on Windows; one
  container solves it.
- MongoDB: same story.
- Consistent across teammates: `docker compose up` = same versions everyone.

Node, Python, and Next.js are often run **outside** Docker in dev because
hot-reload works better when the code lives in your host filesystem. We do
this — you saw it in module 01 (`npm run dev`, `uvicorn ... --reload`).

In production, you'd run **all** services in Docker for consistency.

## Nginx — the reverse proxy

Nginx is a web server. In our stack, its job is to sit in front of everything
and forward requests:

```
Public Internet
     │
     ▼ port 80/443
   nginx
     │
     ├── /            → frontend:3000
     ├── /api/*       → backend-node:3001
     ├── /ai/*        → backend-python:8000
     └── /static/*    → serve files directly
```

Benefits:

- Handle **SSL/TLS** in one place. Backends stay plain HTTP.
- Compress responses (gzip / brotli).
- **Rate-limit** abusive callers.
- Serve **static files** faster than Node.
- **Load-balance** across multiple instances of the same backend.

## Reading our nginx.conf

Open `docker/nginx/nginx.conf`:

```nginx
upstream node_backend {
    server backend-node:3001;
}
upstream python_backend {
    server backend-python:8000;
}
upstream frontend_service {
    server frontend:3000;
}

server {
    listen 80;
    server_name _;

    # Node API
    location /api/ {
        proxy_pass http://node_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Python AI API
    location /ai/ {
        proxy_pass http://python_backend;
        ...
    }

    # Everything else → frontend
    location / {
        proxy_pass http://frontend_service;
    }
}
```

Line by line:

- **`upstream`** blocks — logical groupings of backend servers. Add more
  `server` lines to load-balance.
- **`listen 80`** — accept HTTP on port 80.
- **`location /api/`** — match any URL starting with `/api/`.
- **`proxy_pass`** — forward the request to the named upstream.
- **`proxy_set_header`** — pass along caller info so the backend sees the
  real client IP, not nginx's IP.

## When you'll edit nginx.conf

- Adding SSL: uncomment the `listen 443 ssl` block, add cert paths.
- Serving a new sub-app on `/admin/` — add a new `location` block.
- Rate limiting the login route:
  ```nginx
  limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
  location /api/auth/login {
      limit_req zone=auth burst=5 nodelay;
      proxy_pass http://node_backend;
  }
  ```
- Gzip: add `gzip on; gzip_types application/json text/plain text/css;` at
  the `http` level.

## Common Docker "gotchas"

- **"Cannot connect to Docker daemon"** — Docker Desktop isn't running.
  Start it.
- **Port already in use** — some other process holds the port. Change the
  host side of `"5433:5432"` to a free port, or stop the conflicting
  service.
- **Volume data won't go away** — that's the point of named volumes.
  `docker compose down -v` destroys them if you really want a fresh start.
  Use with care.
- **Image is huge (~3GB)** — Python/Node images with all deps balloon. Use
  slim base images (`python:3.12-slim`, `node:20-alpine`) and only copy the
  final built artefacts to a smaller final image (**multi-stage builds**).

## What you don't need to know yet

- Kubernetes — overkill until you have many services and many nodes.
- Docker Swarm — deprecated in favour of Kubernetes.
- Distributed tracing across containers — nice to have, not blocker.

For this project's scale, Docker Compose is enough for years.

Head to **[Module 12 — Debugging Playbook](./12-debugging-guide.md)** — the final module.

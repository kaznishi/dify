# GEMINI.md

This file provides guidance to Gemini CLI when working with code in this repository.

## Repository Overview

Dify is an open-source LLM application development platform with a microservices architecture. It consists of:

- **API Service** (`/api`): Flask-based Python backend handling core business logic, workflow execution, and model management
- **Web Application** (`/web`): Next.js 15 frontend for visual app building and workflow design
- **Worker Service**: Celery-based asynchronous task processing
- **Plugin Daemon**: Isolated plugin execution environment
- **Docker Infrastructure** (`/docker`): Complete containerized deployment with PostgreSQL, Redis, vector databases, and more

## Common Development Commands

### Backend (API) Development

```bash
# Start middleware for local development (PostgreSQL, Redis, vector DB)
cd docker
docker compose -f docker-compose.middleware.yaml --profile weaviate -p dify up -d

# Install dependencies (uses UV package manager)
uv sync --dev

# Run database migrations
uv run flask db upgrade

# Start API server
uv run flask run --host 0.0.0.0 --port=5001 --debug
# OR use the helper script
dev/start-api

# Start Celery worker
uv run celery -A app.celery worker -P gevent -c 1 --loglevel INFO -Q dataset,generation,mail,ops_trace,app_deletion
# OR use the helper script
dev/start-worker

# Run all tests
uv run -P api bash dev/pytest/pytest_all_tests.sh

# Run specific test categories
dev/pytest/pytest_unit_tests.sh
dev/pytest/pytest_model_runtime.sh
dev/pytest/pytest_tools.sh
dev/pytest/pytest_workflow.sh

# Format code
dev/reformat

# Type checking
dev/mypy-check
```

### Frontend (Web) Development

```bash
# Install dependencies (uses pnpm)
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build

# Run tests
pnpm test
pnpm test:watch  # Watch mode

# Lint and fix
pnpm lint
pnpm fix

# Check i18n translations
pnpm check-i18n

# Storybook for component development
pnpm storybook
```

### Docker Deployment

```bash
# Full stack deployment
cd docker
cp .env.example .env
docker compose up -d

# Build Docker images
make build-web    # Build web image
make build-api    # Build API image
make build-all    # Build all images
```

## High-Level Architecture

### Request Flow
1. **Nginx** → Routes requests to either Web or API service
2. **Web (Next.js)** → Server-side renders UI, makes API calls
3. **API (Flask)** → Handles business logic, delegates async tasks to Celery
4. **Celery Workers** → Process background tasks (document indexing, model inference)
5. **Plugin Daemon** → Executes plugins in isolated environment

### Key Architectural Patterns

#### Model Runtime Abstraction (`/api/core/model_runtime`)
- Unified interface for 100+ LLM providers
- Provider-specific implementations in `/api/core/model_runtime/model_providers`
- Supports text generation, embeddings, speech-to-text, text-to-speech, moderation, and reranking

#### Workflow Engine (`/api/core/workflow`)
- Node-based visual programming system
- Nodes defined in `/api/core/workflow/nodes`
- Execution managed by `workflow_engine_manager.py`
- Supports branching, loops, tool calls, and LLM interactions

#### RAG Pipeline (`/api/core/rag`)
- Document processing and chunking
- Multiple retrieval strategies (vector, keyword, hybrid)
- Reranking and result fusion
- Integrates with 20+ vector databases

#### Plugin System (`/api/core/plugin`)
- Isolated execution via Plugin Daemon
- Supports tools, models, and endpoints
- Marketplace integration for discovery

### Database Schema
- **PostgreSQL** for structured data (users, apps, workflows, etc.)
- **Vector Databases** for embeddings (configurable: Weaviate, Qdrant, Milvus, etc.)
- **Redis** for caching and Celery message broker

### Security Architecture
- **SSRF Proxy** prevents server-side request forgery
- **Sandbox** for secure code execution
- **API Key Management** with role-based access control
- **Tenant Isolation** for multi-tenancy

## Important Configuration

### Environment Variables
- Backend: Copy `api/.env.example` to `api/.env`
- Frontend: Copy `web/.env.example` to `web/.env.local`
- Docker: Copy `docker/.env.example` to `docker/.env`

Key variables to configure:
- `DATABASE_URI`: PostgreSQL connection
- `REDIS_URL`: Redis connection
- `CELERY_BROKER_URL`: Usually same as Redis
- `VECTOR_STORE`: Choice of vector database
- `SECRET_KEY`: Application secret
- `STORAGE_TYPE`: File storage backend

### Development Tips

1. **Working with Workflows**: 
   - Workflow definitions are JSON-based
   - Node implementations in `/api/core/workflow/nodes`
   - Graph execution managed by workflow engine

2. **Adding New Models**:
   - Implement provider in `/api/core/model_runtime/model_providers`
   - Follow existing provider patterns
   - Update provider credentials schema

3. **Frontend State Management**:
   - Uses Zustand for global state
   - SWR for data fetching
   - Context providers in `/web/context`

4. **Database Migrations**:
   - Create: `uv run flask db migrate -m "description"`
   - Apply: `uv run flask db upgrade`
   - Rollback: `uv run flask db downgrade`

5. **Testing Patterns**:
   - Backend: pytest with fixtures
   - Frontend: Jest with React Testing Library
   - Integration tests use Docker containers

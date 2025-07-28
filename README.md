# Ops Center MCP Server

Machine Control Protocol (MCP) server for Operations Center, using MCP Python SDK & JSON-RPC 2.0.

## Features
- Full **CRUD** for tenants, workbenches, requests, tasks, queues, roles, agents, business_observation, exceptions, timelines.
- **Pagination** and **typed schemas** for list endpoints.
- **Authentication**: Bearer token enforcement.
- **SLA/Health**: computes SLA breaches when backend lacks.
- **Idempotency**: supports idempotency‐key on creates.

## Setup
1. Clone:
   ```
   git clone https://github.com/<ORG>/ops-center-mcp.git
   cd ops-center-mcp
   ```
2. Virtualenv:
   ```
   python3 -m venv venv && source venv/bin/activate
   ```
3. Install:
   ```
   pip install -r requirements.txt
   ```
4. Add CSVs in `data/`.
5. Env vars:
   ```
   export OC_API_BASE_URL=https://api.your-ops-center.com/api/v1
   export BEARER_TOKEN=<token>
   export PORT=8000
   ```
6. Run:
   ```
   uvicorn app:app --reload --host 0.0.0.0 --port $PORT
   ```

## Deploy on Render
Use `render.yaml` for automatic build & start.
```
services:
  - type: web
    name: ops-center-mcp
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app:app --host 0.0.0.0 --port $PORT
```

import os, csv, time
from dotenv import load_dotenv
from datetime import datetime, timezone
from starlette.applications import Starlette
from starlette.routing import Mount
from mcp.server.fastmcp import FastMCP
from mcp.shared._httpx_utils import create_mcp_http_client
from models import *

load_dotenv()  # loads .env
OC_API = os.getenv('OC_API_BASE_URL')
TOKEN = os.getenv('BEARER_TOKEN')

# -- CSV loader
def load_csv(name: str):
    path = os.path.join(os.path.dirname(__file__), 'data', f'{name}.csv')
    with open(path, newline='') as f:
        return list(csv.DictReader(f))

# -- Auth verifier
from mcp.server.auth import BearerTokenAuth
auth = BearerTokenAuth(lambda tok: tok == TOKEN)

# -- MCP instantiation
mcp = FastMCP(name="OpsCenterMCP", stateless_http=False, json_response=True, auth=auth)

async def app_lifespan(app: Starlette):
    yield {}

# -- Generic HTTPX client with auth header
async def oc_client():
    headers = {"Authorization": f"Bearer {TOKEN}", "Idempotency-Key": str(time.time())}
    return create_mcp_http_client(headers=headers)

# ---- CRUD Resources & Tools ----
@mcp.resource("ops://tenant/list")
async def list_tenants(cursor: str=None) -> PaginatedResult[Tenant]:
    params = {'cursor': cursor} if cursor else {}
    async with (await oc_client()) as c:
        resp = await c.get(f"{OC_API}/tenants", params=params); resp.raise_for_status()
        data = resp.json()
    return PaginatedResult[Tenant](items=[Tenant(**i) for i in data['items']], nextCursor=data.get('nextCursor'))

@mcp.resource("ops://tenant/{tenant_id}")
async def get_tenant(tenant_id: int) -> Tenant:
    async with (await oc_client()) as c:
        resp = await c.get(f"{OC_API}/tenants/{tenant_id}"); resp.raise_for_status()
        return Tenant(**resp.json())

@mcp.tool()
async def create_tenant(name: str, metadata: dict, idempotency_key: str=None) -> Tenant:
    headers = {"Authorization": f"Bearer {TOKEN}"}
    if idempotency_key: headers['Idempotency-Key'] = idempotency_key
    payload = {'name': name, 'metadata': metadata}
    async with create_mcp_http_client(headers=headers) as c:
        resp = await c.post(f"{OC_API}/tenants", json=payload); resp.raise_for_status()
        return Tenant(**resp.json())

# ... (Repeat CRUD for other entities: workbench, request, task, queue, role, agent, business_observation, business_exception, business_process_timeline)

@mcp.tool()
def compute_health(createdAt: str, threshold_seconds: float) -> HealthStatus:
    created = datetime.fromisoformat(createdAt).replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    elapsed = (now - created).total_seconds()
    return HealthStatus(slaMet=(elapsed <= threshold_seconds), elapsed=elapsed, threshold=threshold_seconds)

from mcp.server.fastmcp.prompts import base

@mcp.prompt(title="Task Summary")
def prompt_task_summary(task_id: int) -> list[base.Message]:
    return [base.UserMessage("Please summarize task details for ID:"), base.UserMessage(str(task_id))]

@mcp.prompt(title="Agent Performance Report")
def prompt_agent_performance(agent_id: int) -> list[base.Message]:
    return [base.UserMessage("Provide performance metrics for agent:"), base.UserMessage(str(agent_id))]

@mcp.prompt(title="Request Health Check")
def prompt_request_health(request_id: int) -> list[base.Message]:
    return [base.UserMessage("Check SLA health for request:"), base.UserMessage(str(request_id))]

app = Starlette(
    debug=True,
    routes=[Mount("/mcp", app=mcp.streamable_http_app(), name="mcp")],
    lifespan=app_lifespan
)

if __name__ == '__main__':
    import uvicorn; uvicorn.run(app, host="0.0.0.0", port=int(os.getenv('PORT', 8000)))

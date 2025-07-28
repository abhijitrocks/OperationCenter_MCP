import os, csv, time
from dotenv import load_dotenv
from datetime import datetime, timezone
from starlette.applications import Starlette
from starlette.routing import Mount
from mcp.server.fastmcp import FastMCP
from mcp.shared._httpx_utils import create_mcp_http_client
from models import *

load_dotenv()
OC_API = os.getenv('OC_API_BASE_URL', 'http://mock.local/api/v1')
TOKEN = os.getenv('BEARER_TOKEN', 'dev-token')

# CSV loader
def load_csv(name: str):
    path = os.path.join(os.path.dirname(__file__), 'data', f'{name}.csv')
    with open(path, newline='') as f:
        return list(csv.DictReader(f))

# MCP instance (no auth)
mcp = FastMCP(name="OpsCenterMCP", stateless_http=False, json_response=True)

async def app_lifespan(app: Starlette):
    yield {}

# Mock resource using CSV
@mcp.resource("ops://tenant/list")
def list_tenants():
    return load_csv("tenants")

@mcp.tool()
def compute_health(createdAt: str, threshold_seconds: float):
    created = datetime.fromisoformat(createdAt).replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    elapsed = (now - created).total_seconds()
    return {
        "slaMet": elapsed <= threshold_seconds,
        "elapsed": elapsed,
        "threshold": threshold_seconds
    }

from mcp.server.fastmcp.prompts import base

@mcp.prompt(title="Task Summary")
def prompt_task_summary(task_id: int) -> list[base.Message]:
    return [base.UserMessage("Summarize task ID:"), base.UserMessage(str(task_id))]

app = Starlette(
    debug=True,
    routes=[Mount("/mcp", app=mcp.streamable_http_app(), name="mcp")],
    lifespan=app_lifespan
)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))

import os
import csv
import time
from dotenv import load_dotenv
from datetime import datetime, timezone
from starlette.applications import Starlette
from starlette.routing import Mount
from starlette.responses import PlainTextResponse
from mcp.server.fastmcp import FastMCP
from mcp.shared._httpx_utils import create_mcp_http_client
from models import *
from mcp.server.fastmcp.prompts import base
from starlette.middleware.cors import CORSMiddleware


load_dotenv()

# Base URL & token (mocks by default)
OC_API = os.getenv('OC_API_BASE_URL', 'http://mock.local/api/v1')
TOKEN = os.getenv('BEARER_TOKEN', 'dev-token')

# CSV loader
def load_csv(name: str):
    path = os.path.join(os.path.dirname(__file__), 'data', f'{name}.csv')
    with open(path, newline='') as f:
        return list(csv.DictReader(f))

# MCP instance (no auth)
mcp = FastMCP(name="OpsCenterMCP", stateless_http=False, json_response=True)

# App lifespan
async def app_lifespan(app: Starlette):
    yield {}

# Create the Starlette app and mount /mcp
app = Starlette(
    debug=True,
    routes=[
        Mount("/mcp/", app=mcp.streamable_http_app(), name="mcp")
    ],
    lifespan=app_lifespan
)
# Enable CORS so browser-based clients can access /mcp
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # in production, replace "*" with your client URL
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)
# Root health-check must come _after_ app is defined
@app.route("/")
async def root(request):
    return PlainTextResponse("✅ MCP Server is live. Use /mcp for JSON-RPC.")

# Mock resource: tenants list
@mcp.resource("ops://tenant/list")
def list_tenants():
    print("Handling tenant list request")
    return load_csv("tenants")

# Example tool: compute SLA/health
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

# Example prompt
@mcp.prompt(title="Task Summary")
def prompt_task_summary(task_id: int) -> list[base.Message]:
    return [
        base.UserMessage("Please summarize task details for ID:"), 
        base.UserMessage(str(task_id))
    ]

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))

import os
import csv
import time
from dotenv import load_dotenv
from datetime import datetime, timezone
from starlette.applications import Starlette
from starlette.routing import Mount
from starlette.responses import PlainTextResponse, JSONResponse
from starlette.requests import Request
from mcp.server.fastmcp import FastMCP
from mcp.shared._httpx_utils import create_mcp_http_client
from models import *
from mcp.server.fastmcp.prompts import base
from starlette.middleware.cors import CORSMiddleware
from starlette.routing import Mount, Router
from starlette.middleware.base import BaseHTTPMiddleware
import json

load_dotenv()

# Base URL & token (mocks by default)
OC_API = os.getenv('OC_API_BASE_URL', 'http://mock.local/api/v1')
TOKEN = os.getenv('BEARER_TOKEN', 'dev-token')

# Authentication middleware
class BearerTokenMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip auth for root health check, discovery endpoint, and MCP status
        if request.url.path in ['/', '/api/discovery', '/api/mcp-status']:
            return await call_next(request)
        
        # Only authenticate MCP endpoints
        if request.url.path.startswith('/mcp'):
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                return JSONResponse(
                    {"error": "Missing or invalid Authorization header"}, 
                    status_code=401
                )
            
            token = auth_header.split(' ')[1]
            if token != TOKEN:
                return JSONResponse(
                    {"error": "Invalid bearer token"}, 
                    status_code=401
                )
        
        return await call_next(request)

# CSV loader with better error handling
def load_csv(name: str):
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    path = os.path.join(data_dir, f'{name}.csv')
    
    # Create data directory and sample file if missing
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
    
    if not os.path.exists(path):
        # Create sample data for tenants
        if name == 'tenants':
            sample_data = [
                {'id': '1', 'name': 'Acme Corp', 'metadata': '{"industry":"tech"}'},
                {'id': '2', 'name': 'Global Industries', 'metadata': '{"industry":"manufacturing"}'},
                {'id': '3', 'name': 'StartupCo', 'metadata': '{"industry":"fintech"}'}
            ]
            with open(path, 'w', newline='') as f:
                if sample_data:
                    writer = csv.DictWriter(f, fieldnames=sample_data[0].keys())
                    writer.writeheader()
                    writer.writerows(sample_data)
        else:
            # Return empty list for other resources
            return []
    
    try:
        with open(path, newline='') as f:
            return list(csv.DictReader(f))
    except Exception as e:
        print(f"Error loading CSV {name}: {e}")
        return []

# MCP instance (no auth)
mcp = FastMCP(name="OpsCenterMCP", stateless_http=True, json_response=True)

# Add a simple initialize handler to ensure proper MCP protocol handling
@mcp.handler("initialize")
async def handle_initialize(params):
    """Handle MCP initialize request"""
    return {
        "protocolVersion": "2024-11-05",
        "capabilities": {
            "resources": {"subscribe": True, "listChanged": True},
            "tools": {},
            "prompts": {}
        },
        "serverInfo": {
            "name": "OpsCenterMCP",
            "version": "1.0.0"
        }
    }

# App lifespan
async def app_lifespan(app: Starlette):
    yield {}

# Create the Starlette app and mount /mcp
# Create MCP Router that avoids redirect issues
mcp_router = Router(routes=[], redirect_slashes=False)

# Get the MCP HTTP app
mcp_http_app = mcp.streamable_http_app()

# Add logging middleware to MCP app for debugging
class MCPLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        print(f"🔍 MCP Request: {request.method} {request.url}")
        print(f"🔍 MCP Headers: {dict(request.headers)}")
        
        try:
            response = await call_next(request)
            print(f"🔍 MCP Response: {response.status_code}")
            return response
        except Exception as e:
            print(f"❌ MCP Error: {e}")
            return JSONResponse(
                {"jsonrpc": "2.0", "id": None, "error": {"code": -32603, "message": f"Internal error: {str(e)}"}},
                status_code=500
            )

# Add logging to MCP app
mcp_http_app.add_middleware(MCPLoggingMiddleware)

# Mount the MCP app
mcp_router.mount("", app=mcp_http_app)

# Main app mounts the router at /mcp
app = Starlette(
    debug=True,
    routes=[
        Mount("/mcp", app=mcp_router, name="mcp")
    ],
    lifespan=app_lifespan
)

# Enable CORS FIRST - must come before authentication middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # in production, replace "*" with your client URL
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Add authentication middleware AFTER CORS
app.add_middleware(BearerTokenMiddleware)

# Root health-check must come _after_ app is defined
@app.route("/")
async def root(request):
    return PlainTextResponse("✅ MCP Server is live. Use /mcp for JSON-RPC.")

# Discovery endpoint for automatic client configuration
@app.route("/api/discovery")
async def discovery_endpoint(request):
    """Endpoint for clients to discover server configuration"""
    base_url = str(request.base_url).rstrip('/')
    return JSONResponse({
        "server_url": base_url,
        "mcp_endpoint": f"{base_url}/mcp",
        "auth_required": True,
        "auth_type": "bearer",
        "server_info": {
            "name": "OpsCenterMCP",
            "version": "1.0.0",
            "description": "Operations Center MCP Server"
        }
    })

# Test endpoint to verify MCP server status
@app.route("/api/mcp-status")
async def mcp_status_endpoint(request):
    """Test endpoint to verify MCP server is working"""
    try:
        # Try to get MCP server info
        mcp_info = {
            "mcp_server_name": mcp.name,
            "resources_count": len(mcp._resources),
            "tools_count": len(mcp._tools),
            "prompts_count": len(mcp._prompts),
            "status": "healthy"
        }
        return JSONResponse(mcp_info)
    except Exception as e:
        return JSONResponse({
            "status": "error",
            "error": str(e)
        }, status_code=500)

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

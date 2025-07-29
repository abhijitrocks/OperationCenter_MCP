#!/usr/bin/env python3
"""
Debug script to test MCP endpoint specifically
"""
import requests
import json

def test_mcp_endpoint(base_url, bearer_token):
    print(f"🧪 Testing MCP endpoint at: {base_url}")
    
    # Test 1: Basic health check
    print("\n1. Testing server health...")
    try:
        health_response = requests.get(f"{base_url}/", timeout=5)
        print(f"   Health check: {health_response.status_code} - {health_response.text[:100]}")
    except Exception as e:
        print(f"   Health check failed: {e}")
        return False
    
    # Test 2: Discovery endpoint
    print("\n2. Testing discovery endpoint...")
    try:
        discovery_response = requests.get(f"{base_url}/api/discovery", timeout=5)
        print(f"   Discovery: {discovery_response.status_code}")
        if discovery_response.ok:
            discovery_data = discovery_response.json()
            print(f"   Discovery data: {json.dumps(discovery_data, indent=2)}")
    except Exception as e:
        print(f"   Discovery failed: {e}")
    
    # Test 3: MCP endpoint without auth (should fail with 401)
    print("\n3. Testing MCP endpoint without auth...")
    test_request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "resources": {"subscribe": True},
                "tools": {},
                "prompts": {}
            },
            "clientInfo": {
                "name": "DebugClient",
                "version": "1.0.0"
            }
        }
    }
    
    try:
        no_auth_response = requests.post(
            f"{base_url}/mcp",
            json=test_request,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        print(f"   No auth: {no_auth_response.status_code} - {no_auth_response.text[:200]}")
    except Exception as e:
        print(f"   No auth test failed: {e}")
    
    # Test 4: MCP endpoint with auth
    print("\n4. Testing MCP endpoint with auth...")
    try:
        auth_response = requests.post(
            f"{base_url}/mcp",
            json=test_request,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {bearer_token}"
            },
            timeout=10
        )
        print(f"   With auth: {auth_response.status_code}")
        if auth_response.ok:
            auth_data = auth_response.json()
            print(f"   Auth response: {json.dumps(auth_data, indent=2)}")
        else:
            print(f"   Auth error: {auth_response.text[:200]}")
    except Exception as e:
        print(f"   Auth test failed: {e}")
    
    # Test 5: CORS preflight check
    print("\n5. Testing CORS preflight...")
    try:
        preflight_response = requests.options(
            f"{base_url}/mcp",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type,Authorization"
            },
            timeout=5
        )
        print(f"   CORS preflight: {preflight_response.status_code}")
        print(f"   CORS headers: {dict(preflight_response.headers)}")
    except Exception as e:
        print(f"   CORS test failed: {e}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python debug_mcp_endpoint.py <base_url> [bearer_token]")
        print("Example: python debug_mcp_endpoint.py https://your-server.onrender.com dev-token")
        sys.exit(1)
    
    base_url = sys.argv[1].rstrip('/')
    bearer_token = sys.argv[2] if len(sys.argv) > 2 else "dev-token"
    
    test_mcp_endpoint(base_url, bearer_token)
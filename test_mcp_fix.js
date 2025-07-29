// Simple test script to verify MCP endpoint fixes
const testMCPEndpoint = async () => {
  console.log('🧪 Testing MCP Endpoint Fixes\n');

  const baseUrl = 'http://localhost:8000'; // Change this to your server URL
  const bearerToken = 'dev-token';

  // Test 1: Health Check
  console.log('1. Testing server health...');
  try {
    const response = await fetch(`${baseUrl}/`);
    console.log(`   ✅ Health check: ${response.status} ${response.ok ? 'OK' : 'FAILED'}`);
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error.message}`);
  }

  // Test 2: Discovery Endpoint
  console.log('\n2. Testing discovery endpoint...');
  try {
    const response = await fetch(`${baseUrl}/api/discovery`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Discovery: ${data.server_info.name}`);
    } else {
      console.log(`   ❌ Discovery failed: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Discovery failed: ${error.message}`);
  }

  // Test 3: MCP Status Endpoint
  console.log('\n3. Testing MCP status endpoint...');
  try {
    const response = await fetch(`${baseUrl}/api/mcp-status`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ MCP Status: ${data.mcp_server_name} (${data.resources_count} resources, ${data.tools_count} tools)`);
    } else {
      console.log(`   ❌ MCP status failed: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ MCP status failed: ${error.message}`);
  }

  // Test 4: MCP Endpoint with Authentication
  console.log('\n4. Testing MCP endpoint with authentication...');
  try {
    const testRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          resources: { subscribe: true },
          tools: {},
          prompts: {}
        },
        clientInfo: {
          name: "TestClient",
          version: "1.0.0"
        }
      }
    };

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearerToken}`
      },
      body: JSON.stringify(testRequest)
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ MCP endpoint working: Protocol ${data.result?.protocolVersion}`);
      console.log(`   📋 Server: ${data.result?.serverInfo?.name} v${data.result?.serverInfo?.version}`);
    } else {
      console.log(`   ❌ MCP endpoint failed: ${response.status}`);
      const errorText = await response.text();
      console.log(`   🔍 Error: ${errorText.slice(0, 200)}`);
    }
  } catch (error) {
    console.log(`   ❌ MCP endpoint failed: ${error.message}`);
  }

  console.log('\n🏁 Test completed!');
  console.log('\n📋 If all tests pass, the MCP endpoint should now work correctly.');
  console.log('   Try running the connection test in your client to verify.');
};

// Run the test
if (typeof window === 'undefined') {
  // Node.js environment
  const fetch = require('node-fetch');
  testMCPEndpoint().catch(console.error);
} else {
  // Browser environment
  testMCPEndpoint().catch(console.error);
}
/**
 * Connection testing utilities for debugging MCP client-server connectivity
 */

export interface ConnectionTestResult {
  url: string;
  healthCheck: boolean;
  discoveryEndpoint: boolean;
  mcpEndpoint: boolean;
  corsEnabled: boolean;
  authRequired: boolean;
  error?: string;
  details: string[];
}

export class ConnectionTester {
  /**
   * Comprehensive connection test for a given server URL
   */
  static async testConnection(serverUrl: string, bearerToken?: string): Promise<ConnectionTestResult> {
    const result: ConnectionTestResult = {
      url: serverUrl,
      healthCheck: false,
      discoveryEndpoint: false,
      mcpEndpoint: false,
      corsEnabled: false,
      authRequired: false,
      details: []
    };

    const baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;

    try {
      // Test 1: Health Check
      result.details.push('🔍 Testing server health check...');
      try {
        const healthResponse = await fetch(`${baseUrl}/`, {
          method: 'GET',
          mode: 'cors',
          signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : (() => {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 5000);
            return controller.signal;
          })()
        });

        if (healthResponse.ok) {
          result.healthCheck = true;
          result.corsEnabled = true; // If we got a response, CORS is working
          result.details.push('✅ Health check passed');
        } else {
          result.details.push(`❌ Health check failed: HTTP ${healthResponse.status}`);
        }
      } catch (error: any) {
        result.details.push(`❌ Health check failed: ${error.message}`);
        if (error.message.includes('CORS')) {
          result.details.push('🔍 CORS issue detected - check server CORS configuration');
        }
      }

      // Test 2: Discovery Endpoint
      result.details.push('🔍 Testing discovery endpoint...');
      try {
        const discoveryResponse = await fetch(`${baseUrl}/api/discovery`, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : (() => {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 5000);
            return controller.signal;
          })()
        });

        if (discoveryResponse.ok) {
          const discoveryData = await discoveryResponse.json();
          result.discoveryEndpoint = true;
          result.details.push('✅ Discovery endpoint accessible');
          result.details.push(`📋 Server info: ${discoveryData.server_info?.name || 'Unknown'}`);
          
          if (discoveryData.auth_required) {
            result.authRequired = true;
            result.details.push('🔐 Authentication required');
          }
        } else {
          result.details.push(`❌ Discovery endpoint failed: HTTP ${discoveryResponse.status}`);
        }
      } catch (error: any) {
        result.details.push(`❌ Discovery endpoint failed: ${error.message}`);
      }

      // Test 2.5: MCP Status Endpoint (for debugging)
      result.details.push('🔍 Testing MCP status endpoint...');
      try {
        const statusResponse = await fetch(`${baseUrl}/api/mcp-status`, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : (() => {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 5000);
            return controller.signal;
          })()
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          result.details.push('✅ MCP status endpoint accessible');
          result.details.push(`📊 MCP server: ${statusData.mcp_server_name}, Resources: ${statusData.resources_count}, Tools: ${statusData.tools_count}`);
        } else {
          result.details.push(`⚠️ MCP status endpoint failed: HTTP ${statusResponse.status}`);
        }
      } catch (error: any) {
        result.details.push(`⚠️ MCP status endpoint failed: ${error.message}`);
      }

      // Test 3: MCP Endpoint (if token provided)
      if (bearerToken) {
        result.details.push('🔍 Testing MCP endpoint with authentication...');
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
                name: "ConnectionTester",
                version: "1.0.0"
              }
            }
          };

          const mcpResponse = await fetch(`${baseUrl}/mcp`, {
            method: 'POST',
            mode: 'cors',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${bearerToken}`
            },
            body: JSON.stringify(testRequest),
            signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : (() => {
              const controller = new AbortController();
              setTimeout(() => controller.abort(), 10000);
              return controller.signal;
            })()
          });

          if (mcpResponse.ok) {
            const mcpData = await mcpResponse.json();
            result.mcpEndpoint = true;
            result.details.push('✅ MCP endpoint accessible with authentication');
            result.details.push(`📋 Protocol version: ${mcpData.result?.protocolVersion || 'Unknown'}`);
            if (mcpData.result?.serverInfo) {
              result.details.push(`📋 Server: ${mcpData.result.serverInfo.name} v${mcpData.result.serverInfo.version}`);
            }
          } else if (mcpResponse.status === 401) {
            result.details.push('❌ MCP endpoint authentication failed (invalid token)');
            try {
              const errorData = await mcpResponse.json();
              result.details.push(`🔍 Auth error details: ${errorData.error || 'No details available'}`);
            } catch {
              result.details.push('🔍 Could not parse auth error response');
            }
          } else {
            result.details.push(`❌ MCP endpoint failed: HTTP ${mcpResponse.status}`);
            try {
              const errorText = await mcpResponse.text();
              result.details.push(`🔍 Error details: ${errorText.slice(0, 200)}`);
            } catch {
              result.details.push('🔍 Could not read error response');
            }
          }
        } catch (error: any) {
          result.details.push(`❌ MCP endpoint failed: ${error.message}`);
        }
      } else {
        result.details.push('⚠️ Skipping MCP endpoint test (no bearer token provided)');
      }

      // Summary
      result.details.push('');
      result.details.push('📊 Test Summary:');
      result.details.push(`   Health Check: ${result.healthCheck ? '✅' : '❌'}`);
      result.details.push(`   Discovery: ${result.discoveryEndpoint ? '✅' : '❌'}`);
      result.details.push(`   MCP Endpoint: ${result.mcpEndpoint ? '✅' : bearerToken ? '❌' : '⚠️ Not tested'}`);
      result.details.push(`   CORS: ${result.corsEnabled ? '✅' : '❌'}`);

    } catch (error: any) {
      result.error = error.message;
      result.details.push(`💥 Unexpected error: ${error.message}`);
    }

    return result;
  }

  /**
   * Quick connectivity test for debugging
   */
  static async quickTest(serverUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.testConnection(serverUrl);
      
      if (result.healthCheck && result.discoveryEndpoint) {
        return {
          success: true,
          message: `✅ Server is accessible at ${serverUrl}`
        };
      } else if (result.healthCheck) {
        return {
          success: false,
          message: `⚠️ Server is reachable but discovery endpoint failed at ${serverUrl}`
        };
      } else {
        return {
          success: false,
          message: `❌ Cannot reach server at ${serverUrl}. Check URL and CORS configuration.`
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `❌ Connection test failed: ${error.message}`
      };
    }
  }

  /**
   * Test multiple URLs and return the first working one
   */
  static async findWorkingServer(urls: string[]): Promise<string | null> {
    console.log('🔍 Testing multiple server URLs...');
    
    for (const url of urls) {
      console.log(`Testing: ${url}`);
      const result = await this.quickTest(url);
      
      if (result.success) {
        console.log(`✅ Found working server: ${url}`);
        return url;
      } else {
        console.log(`❌ ${url}: ${result.message}`);
      }
    }
    
    console.log('❌ No working servers found');
    return null;
  }
}
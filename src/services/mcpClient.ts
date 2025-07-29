import { JSONRPCRequest, JSONRPCResponse, MCPResource, MCPTool, MCPPrompt } from '../types/mcp';

export class MCPClient {
  private baseUrl: string;
  private bearerToken: string;
  private requestId = 1;
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor(baseUrl: string, bearerToken: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.bearerToken = bearerToken;
  }

  private async makeRequest(method: string, params?: any, retryCount = 0): Promise<any> {
    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method,
      params
    };

    try {
      const response = await fetch(`${this.baseUrl}/mcp`, {
        method: 'POST',
        mode: 'cors', // Explicitly set CORS mode
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.bearerToken}`
        },
        body: JSON.stringify(request),
        // Create timeout manually for better browser compatibility
        signal: (() => {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 10000);
          return controller.signal;
        })()
      });

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('Authentication failed: Invalid bearer token');
        }
        if (response.status === 404) {
          throw new Error('MCP endpoint not found: Check server URL');
        }
        if (response.status >= 500) {
          throw new Error(`Server error (${response.status}): ${response.statusText}`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const jsonResponse: JSONRPCResponse = await response.json();
      
      if (jsonResponse.error) {
        throw new Error(`MCP Error: ${jsonResponse.error.message}`);
      }

      return jsonResponse.result;
    } catch (error) {
      // Retry on network errors or timeouts
      if (retryCount < this.maxRetries && 
          (error instanceof TypeError || // Network error
           error.name === 'AbortError' || // Timeout
           (error instanceof Error && error.message.includes('fetch')))) {
        
        console.log(`Request failed, retrying (${retryCount + 1}/${this.maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
        return this.makeRequest(method, params, retryCount + 1);
      }
      
      throw error;
    }
  }

  async initialize(): Promise<{ protocolVersion: string; capabilities: any; serverInfo: any }> {
    return this.makeRequest('initialize', {
      protocolVersion: "2024-11-05",
      capabilities: {
        resources: { subscribe: true },
        tools: {},
        prompts: {}
      },
      clientInfo: {
        name: "OpsCenterMCPClient",
        version: "1.0.0"
      }
    });
  }

  async listResources(): Promise<MCPResource[]> {
    const result = await this.makeRequest('resources/list');
    return result.resources || [];
  }

  async readResource(uri: string): Promise<any> {
    const result = await this.makeRequest('resources/read', { uri });
    return result.contents?.[0]?.text ? JSON.parse(result.contents[0].text) : result;
  }

  async listTools(): Promise<MCPTool[]> {
    const result = await this.makeRequest('tools/list');
    return result.tools || [];
  }

  async callTool(name: string, arguments_: Record<string, any>): Promise<any> {
    const result = await this.makeRequest('tools/call', {
      name,
      arguments: arguments_
    });
    return result.content?.[0]?.text ? JSON.parse(result.content[0].text) : result;
  }

  async listPrompts(): Promise<MCPPrompt[]> {
    const result = await this.makeRequest('prompts/list');
    return result.prompts || [];
  }

  async getPrompt(name: string, arguments_?: Record<string, any>): Promise<any> {
    const result = await this.makeRequest('prompts/get', {
      name,
      arguments: arguments_
    });
    return result;
  }
}
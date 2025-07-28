import { JSONRPCRequest, JSONRPCResponse, MCPResource, MCPTool, MCPPrompt } from '../types/mcp';

export class MCPClient {
  private baseUrl: string;
  private bearerToken: string;
  private requestId = 1;

  constructor(baseUrl: string, bearerToken: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.bearerToken = bearerToken;
  }

  private async makeRequest(method: string, params?: any): Promise<any> {
    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method,
      params
    };

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.bearerToken}`
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const jsonResponse: JSONRPCResponse = await response.json();
    
    if (jsonResponse.error) {
      throw new Error(`MCP Error: ${jsonResponse.error.message}`);
    }

    return jsonResponse.result;
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
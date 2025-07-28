import React, { useState, useEffect } from 'react';
import { MCPClient } from '../services/mcpClient';
import { MCPResource, MCPTool, Tenant, Task, HealthStatus } from '../types/mcp';
import { ResourceType } from './Sidebar';
import { Loader2, Play, RefreshCw } from 'lucide-react';
import { llmService } from '../services/llmService';

interface ResourcePanelProps {
  selectedResource: ResourceType;
  mcpClient: MCPClient | null;
  isConnected: boolean;
}

export function ResourcePanel({ selectedResource, mcpClient, isConnected }: ResourcePanelProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [resources, setResources] = useState<MCPResource[]>([]);
  const [toolParams, setToolParams] = useState<Record<string, any>>({});
  const [summary, setSummary] = useState<string>('');

  useEffect(() => {
    if (isConnected && mcpClient) {
      loadInitialData();
    }
  }, [selectedResource, isConnected, mcpClient]);

  const loadInitialData = async () => {
    if (!mcpClient) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [toolsList, resourcesList] = await Promise.all([
        mcpClient.listTools(),
        mcpClient.listResources()
      ]);
      
      setTools(toolsList);
      setResources(resourcesList);
      
      // Load resource data if available
      if (selectedResource !== 'tools' && selectedResource !== 'chat') {
        const resourceUri = `ops://${selectedResource}/list`;
        const resourceData = resourcesList.find(r => r.uri === resourceUri);
        
        if (resourceData) {
          const data = await mcpClient.readResource(resourceUri);
          setData(data);
          
          // Generate AI summary
          const summary = await llmService.summarizeData(data, selectedResource);
          setSummary(summary);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleToolCall = async (toolName: string) => {
    if (!mcpClient) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = toolParams[toolName] || {};
      const result = await mcpClient.callTool(toolName, params);
      setData(result);
      
      // Generate AI summary
      const summary = await llmService.summarizeData(result, `${toolName} result`);
      setSummary(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const updateToolParam = (toolName: string, paramName: string, value: any) => {
    setToolParams(prev => ({
      ...prev,
      [toolName]: {
        ...prev[toolName],
        [paramName]: value
      }
    }));
  };

  const renderToolForm = (tool: MCPTool) => {
    const properties = tool.inputSchema.properties || {};
    const required = tool.inputSchema.required || [];
    
    return (
      <div key={tool.name} className="card mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">{tool.name}</h3>
            {tool.description && (
              <p className="text-gray-600 text-sm">{tool.description}</p>
            )}
          </div>
          <button
            onClick={() => handleToolCall(tool.name)}
            disabled={loading}
            className="btn-primary flex items-center"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Execute
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(properties).map(([paramName, paramSchema]: [string, any]) => (
            <div key={paramName}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {paramName}
                {required.includes(paramName) && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </label>
              <input
                type={paramSchema.type === 'number' ? 'number' : 'text'}
                placeholder={paramSchema.description || `Enter ${paramName}`}
                className="input-field w-full"
                value={toolParams[tool.name]?.[paramName] || ''}
                onChange={(e) => updateToolParam(
                  tool.name, 
                  paramName, 
                  paramSchema.type === 'number' ? parseFloat(e.target.value) : e.target.value
                )}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderResourceData = () => {
    if (!data) return null;
    
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold capitalize">{selectedResource} Data</h3>
          <button
            onClick={loadInitialData}
            disabled={loading}
            className="btn-secondary flex items-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
        
        {summary && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-blue-900 mb-2">AI Summary</h4>
            <p className="text-blue-800">{summary}</p>
          </div>
        )}
        
        <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-auto">
          <pre className="text-sm">{JSON.stringify(data, null, 2)}</pre>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-600 mb-2">Not Connected</h2>
          <p className="text-gray-500">Please configure your MCP server connection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold capitalize mb-2">{selectedResource}</h2>
          <p className="text-gray-600">
            {selectedResource === 'tools' 
              ? 'Execute MCP tools with custom parameters'
              : `Manage and view ${selectedResource} in your Operations Center`
            }
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-red-900 mb-2">Error</h4>
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            <span className="ml-2 text-gray-600">Loading...</span>
          </div>
        )}

        {selectedResource === 'tools' ? (
          <div>
            {tools.map(renderToolForm)}
            {data && renderResourceData()}
          </div>
        ) : selectedResource === 'chat' ? (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">AI Chat Interface</h3>
            <p className="text-gray-600">Chat interface will be implemented here</p>
          </div>
        ) : (
          renderResourceData()
        )}
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { Sidebar, ResourceType } from './components/Sidebar';
import { ResourcePanel } from './components/ResourcePanel';
import { ChatPanel } from './components/ChatPanel';
import { ConnectionModal } from './components/ConnectionModal';
import { MCPClient } from './services/mcpClient';
import { llmService } from './services/llmService';
import { DiscoveryService } from './services/discoveryService';
import { Settings, Loader2, Wifi, WifiOff } from 'lucide-react';

function App() {
  const [selectedResource, setSelectedResource] = useState<ResourceType>('tenants');
  const [mcpClient, setMcpClient] = useState<MCPClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [discoveryAttempted, setDiscoveryAttempted] = useState(false);

  useEffect(() => {
    initializeConnection();
    // Initialize LLM service
    llmService.initialize().catch(console.error);
  }, []);

  const initializeConnection = async () => {
    setIsInitializing(true);
    
    try {
      // First, try automatic discovery with timeout
      console.log('Attempting automatic server discovery...');
      
      const discoveryPromise = DiscoveryService.discoverServer();
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          console.log('Discovery timeout reached, falling back to saved credentials');
          resolve(null);
        }, 10000); // 10 second total timeout for discovery
      });
      
      const discoveryInfo = await Promise.race([discoveryPromise, timeoutPromise]);
      
      if (discoveryInfo) {
        console.log('Server discovered automatically:', discoveryInfo);
        const token = DiscoveryService.getAuthCredentials();
        
        if (token) {
          await connectToServer(discoveryInfo.server_url, token);
          setDiscoveryAttempted(true);
          return;
        }
      }

      // If discovery fails, try saved connection details
      console.log('Trying saved connection details...');
      const savedUrl = localStorage.getItem('mcp_server_url');
      const savedToken = localStorage.getItem('mcp_bearer_token');
      
      if (savedUrl && savedToken) {
        console.log('Found saved credentials, attempting connection...');
        setServerUrl(savedUrl);
        setBearerToken(savedToken);
        await connectToServer(savedUrl, savedToken);
        setDiscoveryAttempted(true);
        return;
      }

      // If all else fails, show connection modal
      console.log('No automatic discovery or saved credentials, showing manual connection modal');
      setDiscoveryAttempted(true);
      setShowConnectionModal(true);
    } catch (error) {
      console.error('Error during initialization:', error);
      setDiscoveryAttempted(true);
      setShowConnectionModal(true);
    } finally {
      setIsInitializing(false);
    }
  };

  const connectToServer = async (url: string, token: string) => {
    setIsInitializing(true);
    try {
      const client = new MCPClient(url, token);
      await client.initialize();
      
      setMcpClient(client);
      setIsConnected(true);
      setServerUrl(url);
      setBearerToken(token);
      
      // Save connection details
      localStorage.setItem('mcp_server_url', url);
      localStorage.setItem('mcp_bearer_token', token);
      
      console.log('Successfully connected to MCP server');
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      setIsConnected(false);
      setMcpClient(null);
      alert(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleDisconnect = () => {
    setMcpClient(null);
    setIsConnected(false);
    localStorage.removeItem('mcp_server_url');
    localStorage.removeItem('mcp_bearer_token');
    setShowConnectionModal(true);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Initializing MCP Client</h2>
          <p className="text-gray-500">
            {!discoveryAttempted ? 'Discovering server...' : 'Connecting to your Operations Center...'}
          </p>
          <div className="mt-4 text-xs text-gray-400">
            <p>Debug: Check browser console for detailed logs</p>
            <p>Current URL: {window.location.href}</p>
          </div>
          {!discoveryAttempted && (
            <button
              onClick={() => {
                console.log('User skipped discovery');
                setDiscoveryAttempted(true);
                setIsInitializing(false);
                setShowConnectionModal(true);
              }}
              className="mt-4 text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Skip discovery and connect manually
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        selectedResource={selectedResource}
        onResourceSelect={setSelectedResource}
        isConnected={isConnected}
      />
      
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Operations Center</h1>
              <p className="text-gray-600">MCP Client Interface</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center">
                {isConnected ? (
                  <Wifi className="w-4 h-4 text-green-500 mr-2" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-500 mr-2" />
                )}
                <span className={`text-sm font-medium ${isConnected ? 'text-green-700' : 'text-red-700'}`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <button
                onClick={() => setShowConnectionModal(true)}
                className="btn-secondary flex items-center"
              >
                <Settings className="w-4 h-4 mr-2" />
                {isConnected ? 'Reconnect' : 'Connect'}
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex">
          {selectedResource === 'chat' ? (
            <div className="flex-1">
              <ChatPanel mcpClient={mcpClient} isConnected={isConnected} />
            </div>
          ) : (
            <ResourcePanel
              selectedResource={selectedResource}
              mcpClient={mcpClient}
              isConnected={isConnected}
            />
          )}
        </div>
      </div>

      <ConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        onConnect={connectToServer}
        currentUrl={serverUrl}
        currentToken={bearerToken}
      />
    </div>
  );
}

export default App;
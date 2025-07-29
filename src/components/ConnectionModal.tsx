import React, { useState, useEffect } from 'react';
import { X, Server, Key, Search, CheckCircle, AlertTriangle } from 'lucide-react';
import { DiscoveryService } from '../services/discoveryService';
import { ConnectionTester } from '../services/connectionTest';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (url: string, token: string) => void;
  currentUrl?: string;
  currentToken?: string;
}

export function ConnectionModal({ 
  isOpen, 
  onClose, 
  onConnect, 
  currentUrl = '', 
  currentToken = '' 
}: ConnectionModalProps) {
  const [url, setUrl] = useState(currentUrl);
  const [token, setToken] = useState(currentToken);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<string>('');

  useEffect(() => {
    if (isOpen && !currentUrl) {
      attemptAutoDiscovery();
    }
  }, [isOpen, currentUrl]);

  const attemptAutoDiscovery = async () => {
    setIsDiscovering(true);
    setDiscoveryResult('');
    
    try {
      console.log('🔍 Starting comprehensive server discovery...');
      const serverInfo = await DiscoveryService.discoverServer();
      
      if (serverInfo) {
        // Validate the discovered server with connection test
        console.log('🧪 Testing discovered server...');
        const testResult = await ConnectionTester.quickTest(serverInfo.server_url);
        
        if (testResult.success) {
          setUrl(serverInfo.server_url);
          const autoToken = DiscoveryService.getAuthCredentials();
          if (autoToken) {
            setToken(autoToken);
          }
          setDiscoveryResult('✅ Server discovered and validated successfully!');
        } else {
          setDiscoveryResult(`⚠️ Server found but connection test failed: ${testResult.message}`);
          setUrl(serverInfo.server_url); // Still set the URL for manual attempt
        }
      } else {
        setDiscoveryResult('❌ No server found. Please enter details manually.');
        
        // If discovery failed, try to test the current URL if provided
        if (url) {
          console.log('🧪 Testing manually entered URL...');
          const testResult = await ConnectionTester.quickTest(url);
          if (!testResult.success) {
            setDiscoveryResult(`❌ No server found via discovery. Manual URL test: ${testResult.message}`);
          }
        }
      }
    } catch (error) {
      console.error('Discovery error:', error);
      setDiscoveryResult('❌ Discovery failed. Please enter details manually.');
    } finally {
      setIsDiscovering(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && token) {
      onConnect(url, token);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">MCP Server Connection</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isDiscovering && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center">
            <Search className="w-4 h-4 animate-spin text-blue-600 mr-2" />
            <span className="text-blue-800">Discovering server automatically...</span>
          </div>
        )}

        {discoveryResult && (
          <div className={`mb-4 p-3 rounded-lg flex items-center ${
            discoveryResult.startsWith('✅') ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
          }`}>
            {discoveryResult.startsWith('✅') ? (
              <CheckCircle className="w-4 h-4 mr-2" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            <span>{discoveryResult}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Server className="w-4 h-4 inline mr-2" />
              Server URL
            </label>
            <div className="flex space-x-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-mcp-server.onrender.com"
                className="input-field flex-1"
                required
              />
              <button
                type="button"
                onClick={attemptAutoDiscovery}
                disabled={isDiscovering}
                className="btn-secondary px-3"
                title="Auto-discover server"
              >
                <Search className={`w-4 h-4 ${isDiscovering ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Your Render deployment URL (without /mcp path)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Key className="w-4 h-4 inline mr-2" />
              Bearer Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Your authentication token"
              className="input-field w-full"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              The BEARER_TOKEN from your server environment
            </p>
          </div>

          <div className="flex space-x-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (url) {
                  console.log('🧪 Running comprehensive connection test...');
                  const result = await ConnectionTester.testConnection(url, token);
                  console.log('📊 Connection test results:', result);
                  alert(`Connection Test Results:\n\n${result.details.join('\n')}`);
                }
              }}
              className="btn-secondary px-3"
              disabled={!url || isDiscovering}
              title="Test connection to server"
            >
              Test
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              Connect
            </button>
          </div>
        </form>

        <div className="mt-6 space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Connection Troubleshooting:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Auto-discovery failed?</strong> Try the "Test" button to diagnose issues</li>
              <li>• <strong>CORS errors?</strong> Ensure server has proper CORS configuration</li>
              <li>• <strong>Authentication issues?</strong> Check your bearer token matches server's BEARER_TOKEN</li>
              <li>• <strong>URL format:</strong> Use full URL without /mcp path (e.g., https://server.onrender.com)</li>
            </ul>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg">
            <h3 className="font-medium text-green-900 mb-2">Sample Prompts to Try After Connecting:</h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• "List all tenants in our Operations Center"</li>
              <li>• "Show me pending tasks for tenant ID 42"</li>
              <li>• "Compute SLA health for request 1234"</li>
              <li>• "Summarize the details of task 5678"</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
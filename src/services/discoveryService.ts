export interface ServerDiscoveryInfo {
  server_url: string;
  mcp_endpoint: string;
  auth_required: boolean;
  auth_type: string;
  server_info: {
    name: string;
    version: string;
    description: string;
  };
}

export class DiscoveryService {
  private static readonly COMMON_PORTS = [8000, 3000, 5000, 8080, 10000];
  private static readonly DISCOVERY_ENDPOINTS = [
    '/api/discovery',
    '/discovery',
    '/mcp/discovery'
  ];

  /**
   * Get potential server URLs based on current client location
   */
  private static getPotentialServerUrls(): string[] {
    const urls: string[] = [];
    const currentHostname = window.location.hostname;
    const currentOrigin = window.location.origin;
    
    console.log('Current client location:', currentOrigin);
    
    // For Render.com deployments
    if (currentHostname.includes('onrender.com')) {
      // If client and server are on the same service, try current origin first
      urls.push(currentOrigin);
      
      // Try different service name patterns for Render
      const possibleServerNames = [
        // Remove -client suffix
        currentHostname.replace('-client', ''),
        // Replace client with server
        currentHostname.replace('client', 'server'),
        // Specific pattern for this project
        currentHostname.replace('mcp-client', 'ops-center-mcp'),
        // Direct service name (in case user deployed with different name)
        'ops-center-mcp.onrender.com',
        // Alternative patterns
        currentHostname.replace('ui', 'api'),
        currentHostname.replace('frontend', 'backend')
      ];
      
      // Add all unique server URLs
      for (const serverName of [...new Set(possibleServerNames)]) {
        if (serverName !== currentHostname && serverName.includes('onrender.com')) {
          urls.push(`https://${serverName}`);
        }
      }
      
      console.log('Render.com deployment detected, trying server patterns:', possibleServerNames);
    }
    
    // For localhost development
    if (currentHostname === 'localhost' || currentHostname === '127.0.0.1') {
      // Try common development ports
      for (const port of [8000, 3000, 5000]) {
        urls.push(`http://localhost:${port}`);
        urls.push(`http://127.0.0.1:${port}`);
      }
    }
    
    // Generic patterns for other deployments
    const genericHosts = [
      currentHostname.replace('client', 'server'),
      currentHostname.replace('ui', 'api'),
      currentHostname.replace('frontend', 'backend')
    ].filter(host => host !== currentHostname);
    
    for (const host of genericHosts) {
      urls.push(`https://${host}`);
      urls.push(`http://${host}`);
    }
    
    console.log('Potential server URLs to try:', urls);
    return [...new Set(urls)]; // Remove duplicates
  }

  /**
   * Attempts to automatically discover the MCP server
   */
  static async discoverServer(): Promise<ServerDiscoveryInfo | null> {
    console.log('Starting automatic server discovery...');

    const potentialUrls = this.getPotentialServerUrls();
    
    // Try URLs in parallel for faster discovery (limit to 3 concurrent to avoid overwhelming)
    const batchSize = 3;
    for (let i = 0; i < potentialUrls.length; i += batchSize) {
      const batch = potentialUrls.slice(i, i + batchSize);
      console.log(`Trying batch ${Math.floor(i/batchSize) + 1}: ${batch.join(', ')}`);
      
      const promises = batch.map(url => this.tryDiscovery(url));
      const results = await Promise.allSettled(promises);
      
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled' && result.value) {
          console.log('✅ Found server at:', batch[j]);
          return result.value;
        }
      }
    }

    console.log('❌ Server discovery failed - no server found');
    return null;
  }

  /**
   * Try to discover server at a specific base URL
   */
  private static async tryDiscovery(baseUrl: string): Promise<ServerDiscoveryInfo | null> {
    // First, try a quick health check to see if server is reachable
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const healthResponse = await fetch(`${baseUrl}/`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!healthResponse.ok) {
        console.log(`  ❌ Server not reachable at ${baseUrl} (HTTP ${healthResponse.status})`);
        return null;
      }
    } catch (error) {
      console.log(`  ❌ Server not reachable at ${baseUrl}: ${error.message}`);
      return null;
    }
    
    // If server is reachable, try discovery endpoints
    for (const endpoint of this.DISCOVERY_ENDPOINTS) {
      try {
        console.log(`  Trying: ${baseUrl}${endpoint}`);
        
        // Create timeout manually for better browser compatibility
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (this.isValidDiscoveryResponse(data)) {
            console.log(`  ✅ Valid response from ${baseUrl}${endpoint}`);
            return data as ServerDiscoveryInfo;
          } else {
            console.log(`  ❌ Invalid response structure from ${baseUrl}${endpoint}`);
          }
        } else {
          console.log(`  ❌ HTTP ${response.status} from ${baseUrl}${endpoint}`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log(`  ⏱️ Timeout for ${baseUrl}${endpoint}`);
        } else {
          console.log(`  ❌ Error for ${baseUrl}${endpoint}: ${error.message}`);
        }
        continue;
      }
    }
    return null;
  }

  /**
   * Validate that the discovery response has the expected structure
   */
  private static isValidDiscoveryResponse(data: any): boolean {
    return (
      data &&
      typeof data.server_url === 'string' &&
      typeof data.mcp_endpoint === 'string' &&
      typeof data.auth_required === 'boolean' &&
      data.server_info &&
      typeof data.server_info.name === 'string'
    );
  }

  /**
   * Generate a default bearer token for development
   * In production, this would be retrieved from a secure source
   */
  static generateDefaultToken(): string {
    // For development, use the same default as the server
    return 'dev-token';
  }

  /**
   * Attempt to retrieve stored credentials or generate defaults
   */
  static getAuthCredentials(): string {
    // Try to get from environment or localStorage
    const stored = localStorage.getItem('mcp_bearer_token');
    if (stored) {
      return stored;
    }

    // For development environments, use default token
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('onrender.com')) {
      return this.generateDefaultToken();
    }

    // In production, this should prompt for credentials
    return '';
  }
}
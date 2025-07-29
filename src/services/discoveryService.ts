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
  private static readonly COMMON_HOSTS = [
    'localhost',
    '127.0.0.1',
    // Add Render.com pattern
    window.location.hostname.includes('onrender.com') 
      ? window.location.hostname.replace('-client', '-server').replace('mcp-client', 'ops-center-mcp')
      : null,
    // Add common deployment patterns
    window.location.hostname.replace('client', 'server'),
    window.location.hostname.replace('ui', 'api'),
  ].filter(Boolean);

  private static readonly DISCOVERY_ENDPOINTS = [
    '/api/discovery',
    '/discovery',
    '/mcp/discovery'
  ];

  /**
   * Attempts to automatically discover the MCP server
   */
  static async discoverServer(): Promise<ServerDiscoveryInfo | null> {
    console.log('Starting automatic server discovery...');

    // Try current domain first (for Render deployments)
    const currentOrigin = window.location.origin;
    const serverInfo = await this.tryDiscovery(currentOrigin);
    if (serverInfo) {
      console.log('Found server on current domain:', currentOrigin);
      return serverInfo;
    }

    // Try common host patterns
    for (const host of this.COMMON_HOSTS) {
      if (!host) continue;
      
      // Try HTTPS first, then HTTP
      for (const protocol of ['https', 'http']) {
        const baseUrl = `${protocol}://${host}`;
        const info = await this.tryDiscovery(baseUrl);
        if (info) {
          console.log('Found server at:', baseUrl);
          return info;
        }
      }

      // Try with common ports
      for (const port of this.COMMON_PORTS) {
        for (const protocol of ['https', 'http']) {
          const baseUrl = `${protocol}://${host}:${port}`;
          const info = await this.tryDiscovery(baseUrl);
          if (info) {
            console.log('Found server at:', baseUrl);
            return info;
          }
        }
      }
    }

    console.log('Server discovery failed - no server found');
    return null;
  }

  /**
   * Try to discover server at a specific base URL
   */
  private static async tryDiscovery(baseUrl: string): Promise<ServerDiscoveryInfo | null> {
    for (const endpoint of this.DISCOVERY_ENDPOINTS) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const data = await response.json();
          if (this.isValidDiscoveryResponse(data)) {
            return data as ServerDiscoveryInfo;
          }
        }
      } catch (error) {
        // Silently continue - this is expected for most attempts
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
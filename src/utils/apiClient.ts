import { tokenManager } from './tokenManager';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = await tokenManager.getValidAccessToken();
    
    if (!token) {
      throw new Error('No valid access token available');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      const newToken = await tokenManager.refreshAccessToken();
      if (newToken) {
        const retryHeaders = {
          ...headers,
          'Authorization': `Bearer ${newToken}`
        };
        
        return fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers: retryHeaders
        });
      } else {
        throw new Error('Authentication failed - please configure tokens');
      }
    }

    return response;
  }

  // XML to JSON conversion via API
  async convertXmlToJsonAPI(xmlContent: string, options?: any): Promise<string> {
    const response = await this.makeAuthenticatedRequest('/convert/xml-to-json', {
      method: 'POST',
      body: JSON.stringify({ 
        xmlContent, 
        options: options || {} 
      })
    });
    
    if (!response.ok) {
      throw new Error(`Conversion failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.jsonOutput;
  }

  async get(endpoint: string): Promise<any> {
    const response = await this.makeAuthenticatedRequest(endpoint, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    
    return response.json();
  }

  async post(endpoint: string, data: any): Promise<any> {
    const response = await this.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    
    return response.json();
  }
}

export const apiClient = new ApiClient();
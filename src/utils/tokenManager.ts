interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

class TokenManager {
  private static instance: TokenManager;
  private tokenData: TokenData | null = null;
  private readonly STORAGE_KEY = 'api_tokens';

  private constructor() {
    this.loadTokens();
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  private loadTokens(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.tokenData = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load tokens:', error);
      this.tokenData = null;
    }
  }

  private saveTokens(): void {
    try {
      if (this.tokenData) {
        // Save to localStorage
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tokenData));
        
        // Also save refresh token to file/DB (simulation)
        this.saveRefreshTokenToFile(this.tokenData.refreshToken);
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to save tokens:', error);
    }
  }

  private saveRefreshTokenToFile(refreshToken: string): void {
    try {
      // Simulate saving to file/DB
      const tokenData = {
        refreshToken,
        savedAt: new Date().toISOString(),
        source: 'xml-converter-app'
      };
      
      // In real app, this would be API call to backend
      localStorage.setItem('refresh_token_backup', JSON.stringify(tokenData));
      console.log('Refresh token saved to backup storage');
    } catch (error) {
      console.error('Failed to backup refresh token:', error);
    }
  }

  setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    this.tokenData = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + (expiresIn * 1000)
    };
    this.saveTokens();
  }

  getAccessToken(): string | null {
    if (!this.tokenData) return null;
    
    if (Date.now() >= this.tokenData.expiresAt) {
      return null; // Token expired
    }
    
    return this.tokenData.accessToken;
  }

  getRefreshToken(): string | null {
    return this.tokenData?.refreshToken || null;
  }

  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await fetch('/api/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) throw new Error('Token refresh failed');

      const data = await response.json();
      this.setTokens(data.accessToken, data.refreshToken || refreshToken, data.expiresIn);
      
      return data.accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
      return null;
    }
  }

  async getValidAccessToken(): Promise<string | null> {
    let token = this.getAccessToken();
    
    if (!token) {
      token = await this.refreshAccessToken();
    }
    
    return token;
  }

  clearTokens(): void {
    this.tokenData = null;
    this.saveTokens();
  }

  hasTokens(): boolean {
    return this.tokenData !== null;
  }
}

export const tokenManager = TokenManager.getInstance();
// src/api/client.js

/**
 * Meassnea System - Central API Client
 * This client manages all fetch operations to the Cloudflare Worker D1 backend.
 * - Local Development: Falls back to http://localhost:8787
 * - Production: Uses the URL specified in VITE_API_URL environment variable
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

/**
 * Simple in-memory cache for GET requests
 */
const requestCache = new Map();
const cacheTimestamps = new Map();
const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day (24 hours)

export const api = {
  /**
   * Configure cache behavior
   */
  cacheConfig: {
    enabled: true,
    ttl: DEFAULT_CACHE_TTL,
    excludePaths: [] // Add paths to never cache, e.g., ['/auth', '/realtime']
  },

  /**
   * Core request handler with optional caching for GET requests
   */
  async request(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${BASE_URL}/api${cleanEndpoint}`;
    const method = options.method || 'GET';
    
    // Only cache GET requests
    const isCacheable = method === 'GET' && 
                       this.cacheConfig.enabled &&
                       !this.cacheConfig.excludePaths.some(path => cleanEndpoint.includes(path));
    
    const cacheKey = `${method}:${cleanEndpoint}`;
    const forceRefresh = options.forceRefresh || false;

    // Check cache first
    if (isCacheable && !forceRefresh) {
      const cached = requestCache.get(cacheKey);
      const timestamp = cacheTimestamps.get(cacheKey);
      
      if (cached && timestamp && (Date.now() - timestamp) < this.cacheConfig.ttl) {
        // console.log(`[Cache HIT] ${cacheKey}`);
        return cached;
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    const config = {
      ...options,
      headers,
      mode: 'cors',
    };

    // Remove internal options before fetch
    delete config.forceRefresh;

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorMessage = `HTTP Error: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Fallback if response is not JSON
        }
        throw new Error(errorMessage);
      }

      if (response.status === 204) {
        return null;
      }

      const data = await response.json();

      // Store in cache for GET requests
      if (isCacheable) {
        requestCache.set(cacheKey, data);
        cacheTimestamps.set(cacheKey, Date.now());
        // console.log(`[Cache SET] ${cacheKey}`);
      }

      return data;
    } catch (error) {
      console.error(`[API Error] Request to ${url} failed:`, error.message);
      throw error;
    }
  },

  /**
   * Clear specific cache entry or pattern
   */
  clearCache(pattern) {
    if (!pattern) {
      requestCache.clear();
      cacheTimestamps.clear();
      return;
    }
    
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    for (const key of requestCache.keys()) {
      if (regex.test(key)) {
        requestCache.delete(key);
        cacheTimestamps.delete(key);
      }
    }
  },

  /**
   * Send HTTP GET request
   */
  get(endpoint, options = {}) {
    return this.request(endpoint, { method: 'GET', ...options });
  },

  /**
   * Send HTTP POST request
   */
  post(endpoint, data, options = {}) {
    // Auto-invalidate related GET cache on mutation
    this.clearCache(`GET:${endpoint}`);
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options,
    });
  },

  /**
   * Send HTTP PUT request
   */
  put(endpoint, data, options = {}) {
    this.clearCache(`GET:${endpoint}`);
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options,
    });
  },

  /**
   * Send HTTP PATCH request
   */
  patch(endpoint, data, options = {}) {
    this.clearCache(`GET:${endpoint}`);
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
      ...options,
    });
  },

  /**
   * Send HTTP DELETE request
   */
  delete(endpoint, options = {}) {
    this.clearCache(`GET:${endpoint}`);
    return this.request(endpoint, {
      method: 'DELETE',
      ...options,
    });
  },
};
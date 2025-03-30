import { getTokenFromStorage } from '../utils/storage';
import { config } from './config';
import { ApiErrorResponse } from './types';

/**
 * A wrapper around the native fetch function that automatically:
 * - Prepends the base API URL.
 * - Adds the Content-Type: application/json header.
 * - Adds the Authorization: Bearer <token> header if a token exists.
 * - Parses JSON response and handles API errors gracefully.
 *
 * @param endpoint - The API endpoint (e.g., '/auth/login').
 * @param options - Optional fetch options (method, body, etc.). Defaults to GET.
 * @param requiresAuth - Whether the endpoint requires authentication (defaults to true).
 * @returns A promise resolving with the JSON response data.
 * @throws An error if the request fails or the API returns an error status.
 */
export async function fetchWrapper<T>(endpoint: string, options: RequestInit = {}, requiresAuth: boolean = true): Promise<T> {
  const url = `${config.baseUrl}${endpoint}`;
  const headers = new Headers(options.headers || {});

  // Set default Content-Type if not already set and body exists
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Add Authorization header if required and token exists
  if (requiresAuth) {
    const token = getTokenFromStorage();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    } else {
      // Optionally handle the case where auth is required but no token exists
      // Could throw an error, redirect to login, or let the API handle it
      console.warn(`Auth required for ${endpoint}, but no token found.`);
      // Depending on API design, this might still proceed and result in a 401
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data: any;
  try {
      // Try to parse JSON, handle cases where response might be empty (e.g., 204 No Content)
      const text = await response.text();
      data = text ? JSON.parse(text) : null;
  } catch (e) {
      // Handle non-JSON responses or parsing errors
      console.error("Failed to parse JSON response:", e);
      // Throw an error or return a specific value depending on desired behavior
      throw new Error(`Invalid response received from server for ${endpoint}. Status: ${response.status}`);
  }


  if (!response.ok) {
    const errorResponse = data as ApiErrorResponse;
    const message = errorResponse?.message ?? `Request failed with status ${response.status}`;
    const errorMessage = Array.isArray(message)
      ? message.join(', ')
      : message;
    console.error(`API Error for ${endpoint}:`, errorMessage, data);
    throw new Error(errorMessage);
  }

  return data as T;
} 
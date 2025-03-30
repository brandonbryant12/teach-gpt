// Define common types used across the client

/**
 * Standard API error response structure.
 */
export interface ApiErrorResponse {
  message: string | string[]; // NestJS validation errors can be string[]
  error?: string;
  statusCode: number;
}

/**
 * Credentials needed for the login endpoint.
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Data needed for the user registration endpoint.
 */
export interface RegisterUserData {
  email: string;
  password: string; // Server ensures minimum length
}

/**
 * Response from the login endpoint.
 */
export interface LoginResponse {
  access_token: string;
}

/**
 * Response from the user profile endpoint.
 */
export interface UserProfile {
  userId: number;
  email: string;
}

// Add other shared request/response types here as needed 
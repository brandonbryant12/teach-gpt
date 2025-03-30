import { fetchWrapper } from '../fetchWrapper';
import { LoginResponse, LoginCredentials } from '../types';

/**
 * Calls the login API endpoint.
 * @param credentials - The user's email and password.
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  return fetchWrapper<LoginResponse>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      },
      false // Login does not require auth
  );
} 
import { fetchWrapper } from '../fetchWrapper';
import { UserProfile } from '../types';

/**
 * Fetches the profile of the currently authenticated user.
 * Requires a valid JWT token to be present in localStorage.
 */
export async function getProfile(): Promise<UserProfile> {
    return fetchWrapper<UserProfile>(
        '/auth/profile', // Endpoint defined in AuthController
        { method: 'GET' }, // Default method is GET, but explicitly stating
        true // This endpoint requires authentication
    );
} 
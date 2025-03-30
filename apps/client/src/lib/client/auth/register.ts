import { fetchWrapper } from '../fetchWrapper';
import { RegisterUserData } from '../types';

/**
 * Calls the user registration API endpoint.
 * @param userData - The new user's email and password.
 */
export async function register(userData: RegisterUserData): Promise<unknown> {
    return fetchWrapper<unknown>(
        '/user/register',
        {
            method: 'POST',
            body: JSON.stringify(userData),
        },
        false // Registration does not require auth
    );
}
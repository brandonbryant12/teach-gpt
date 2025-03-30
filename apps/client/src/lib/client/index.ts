import { login } from './auth/login';
import { register } from './auth/register';
import { getProfile } from './auth/getProfile';
// Import other client functions/modules here as they are created
// e.g., import * as user from './user';

/**
 * Teach GPT API Client
 */
export const teachGptClient = {
  auth: {
    login,
    register,
    getProfile,
    // Add other auth functions here (e.g., logout, getProfile)
  },
  // user,
  // Add other top-level modules here (e.g., user, posts)
}; 
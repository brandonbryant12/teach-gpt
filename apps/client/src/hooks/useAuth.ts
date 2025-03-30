import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext'; // Adjust path as needed

/**
 * Custom hook to access the authentication context.
 * Provides a convenient way to get auth state and actions.
 * Throws an error if used outside of an AuthProvider.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 
/**
 * Retrieves the access token from localStorage.
 * Handles potential errors during access.
 */
export const getTokenFromStorage = (): string | null => {
  try {
    return localStorage.getItem('accessToken');
  } catch (e) {
    console.error('Failed to read token from localStorage', e);
    return null;
  }
};

/**
 * Stores or removes the access token in localStorage.
 * Handles potential errors during access.
 * @param token - The token string or null to remove it.
 */
export const setTokenInStorage = (token: string | null) => {
  try {
    if (token) {
      localStorage.setItem('accessToken', token);
    } else {
      localStorage.removeItem('accessToken');
    }
  } catch (e) {
    console.error('Failed to update token in localStorage', e);
  }
}; 
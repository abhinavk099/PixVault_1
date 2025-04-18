// Token management functions
const tokenManager = {
  getAccessToken: () => {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  },
  getRefreshToken: () => {
    return localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
  },
  isTokenExpired: () => {
    const expiry = localStorage.getItem('authTokenExpiry') || sessionStorage.getItem('authTokenExpiry');
    if (!expiry) return true;
    return new Date(expiry) < new Date();
  }
};

export default tokenManager;

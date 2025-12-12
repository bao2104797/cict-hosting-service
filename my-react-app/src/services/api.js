import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

/**
 * Axios instance for API calls
 * @type {import('axios').AxiosInstance}
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;


// src/utils/api.js

const BASE_URL = "https://moon-bbh0.onrender.com";

/**
 * 전역 공통 API 호출 함수
 * @param {string} endpoint - API 엔드포인트 (예: "/api/news")
 * @param {object} options - fetch 옵션 (method, body 등)
 * @returns {Promise<any>} - JSON 응답 객체 반환
 */
export const fetchApi = async (endpoint, options = {}) => {
  const url = `${BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error(`[API 통신 오류] ${endpoint}:`, error);
    throw error; 
  }
};

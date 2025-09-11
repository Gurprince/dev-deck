// frontend/src/services/testService.js
import axios from "axios";

export const runRequest = async ({ method, url, headers, body }) => {
  try {
    const response = await axios({
      method,
      url,
      headers: headers ? JSON.parse(headers) : {},
      data: body ? JSON.parse(body) : undefined,
    });
    return {
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  } catch (error) {
    console.error("API request failed:", error);
    return {
      status: error.response?.status || 500,
      data: { message: error.message },
      headers: {},
    };
  }
};

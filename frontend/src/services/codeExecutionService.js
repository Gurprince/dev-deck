// frontend/src/services/codeExecutionService.js
import axios from 'axios';

const API_URL = '/api';

export const executeCode = async (code) => {
  try {
    const response = await axios.post(`${API_URL}/execute`, { code });
    return response.data;
  } catch (error) {
    console.error('Error executing code:', error);
    throw error;
  }
};

export const stopExecution = async (executionId) => {
  try {
    const response = await axios.post(`${API_URL}/stop-execution`, { executionId });
    return response.data;
  } catch (error) {
    console.error('Error stopping execution:', error);
    throw error;
  }
};

export const checkExecutionStatus = async (executionId) => {
  try {
    const response = await axios.get(`${API_URL}/execution-status/${executionId}`);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return { isRunning: false };
    }
    throw error;
  }
};

// Track running executions
const executionStore = {
  currentExecution: null,
  
  setExecution(id, port) {
    this.currentExecution = { id, port };
  },
  
  clearExecution() {
    this.currentExecution = null;
  },
  
  getCurrentExecution() {
    return this.currentExecution;
  }
};

export { executionStore };
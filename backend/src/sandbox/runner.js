// backend/src/sandbox/runner.js
import { logger } from "./logger.js";

export const runCode = (code, method, path) => {
  // Mock execution (replace with Docker sandbox later)
  logger.addLog(`Executing ${method} ${path}`);
  try {
    // Simulate parsing and running the code
    // For real execution, eval(code) is unsafe; use Docker or VM
    logger.addLog(`[${new Date().toISOString()}] Simulated server started`);
    logger.addLog(`[${new Date().toISOString()}] ${method} ${path} - 200 OK`);
  } catch (error) {
    logger.addLog(
      `[${new Date().toISOString()}] Execution error: ${error.message}`
    );
  }
  return logger.getLogs();
};

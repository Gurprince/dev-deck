// backend/src/sandbox/logger.js
export const logger = {
  logs: [],
  addLog(message) {
    const log = `[${new Date().toISOString()}] ${message}`;
    this.logs.push(log);
    return log;
  },
  getLogs() {
    return this.logs;
  },
  clearLogs() {
    this.logs = [];
  },
};

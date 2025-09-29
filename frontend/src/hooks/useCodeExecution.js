// frontend/src/hooks/useCodeExecution.js
import { useState, useEffect } from 'react';
import { executeCode, stopExecution, executionStore } from '../services/codeExecutionService';

export const useCodeExecution = (initialCode = '') => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [output, setOutput] = useState('');
  const [isServerRunning, setIsServerRunning] = useState(false);

  const execute = async (code) => {
    try {
      setIsExecuting(true);
      setOutput('Executing code...\n');

      // Stop any running server first
      const currentExecution = executionStore.getCurrentExecution();
      if (currentExecution) {
        try {
          await stopExecution(currentExecution.id);
          executionStore.clearExecution();
          setOutput(prev => prev + `\nStopped previous server on port ${currentExecution.port}\n`);
        } catch (error) {
          console.error('Error stopping previous execution:', error);
        }
      }

      const result = await executeCode(code);
      
      if (result.success) {
        setOutput(prev => prev + (result.output || '') + '\n');
        if (result.error) {
          setOutput(prev => prev + 'Error: ' + result.error + '\n');
        }
      } else {
        setOutput(prev => prev + 'Error: ' + (result.message || 'Execution failed') + '\n');
      }

      // Check if server was started
      if (result.output && result.output.includes('SERVER_STARTED:')) {
        const port = result.output.match(/SERVER_STARTED:(\d+)/)[1];
        executionStore.setExecution(`exec-${Date.now()}`, port);
        setIsServerRunning(true);
      }
    } catch (error) {
      console.error('Execution error:', error);
      setOutput(prev => prev + 'Error: ' + (error.message || 'Failed to execute code') + '\n');
    } finally {
      setIsExecuting(false);
    }
  };

  const stop = async () => {
    try {
      const currentExecution = executionStore.getCurrentExecution();
      if (currentExecution) {
        await stopExecution(currentExecution.id);
        executionStore.clearExecution();
        setIsServerRunning(false);
        setOutput(prev => prev + `\nServer on port ${currentExecution.port} stopped.\n`);
        return true;
      }
    } catch (error) {
      console.error('Error stopping execution:', error);
      setOutput(prev => prev + 'Error stopping server: ' + (error.message || 'Unknown error') + '\n');
      return false;
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      const currentExecution = executionStore.getCurrentExecution();
      if (currentExecution) {
        stopExecution(currentExecution.id).catch(console.error);
        executionStore.clearExecution();
      }
    };
  }, []);

  return {
    isExecuting,
    output,
    isServerRunning,
    execute,
    stop,
    setOutput
  };
};
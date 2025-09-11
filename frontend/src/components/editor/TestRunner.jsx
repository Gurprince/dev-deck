import { useMemo, useState } from 'react';
import { executionApi } from '../../services/api';

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const TestRunner = ({ endpoints = [] }) => {
  const first = endpoints[0];
  const [method, setMethod] = useState(first?.method || 'GET');
  const [path, setPath] = useState(first?.path || '/');
  const [headers, setHeaders] = useState('{"Content-Type":"application/json"}');
  const [body, setBody] = useState('{}');
  const [resp, setResp] = useState(null);
  const [loading, setLoading] = useState(false);

  const onRun = async () => {
    setLoading(true);
    setResp(null);
    try {
      const hdrs = JSON.parse(headers || '{}');
      const bdy = body && body.trim() ? JSON.parse(body) : null;
      const { data } = await executionApi.testEndpoint({
        url: path,
        method,
        headers: hdrs,
        body: bdy,
      });
      setResp(data);
    } catch (e) {
      setResp({ error: e.message || 'Failed to run request' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-2 py-1 border rounded">
          {methods.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input value={path} onChange={(e) => setPath(e.target.value)} className="flex-1 px-2 py-1 border rounded" placeholder="http://localhost:3000/api/hello or /api/hello" />
        <button onClick={onRun} disabled={loading} className="px-3 py-1 rounded bg-indigo-600 text-white">{loading ? 'Testing...' : 'Send'}</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-sm mb-1">Headers (JSON)</div>
          <textarea value={headers} onChange={(e) => setHeaders(e.target.value)} rows={6} className="w-full border rounded p-2 font-mono text-sm" />
        </div>
        <div>
          <div className="text-sm mb-1">Body (JSON)</div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="w-full border rounded p-2 font-mono text-sm" />
        </div>
      </div>
      <div>
        <div className="text-sm mb-1">Response</div>
        <pre className="w-full border rounded p-2 bg-gray-50 overflow-auto text-sm">{resp ? JSON.stringify(resp, null, 2) : 'No response yet.'}</pre>
      </div>
    </div>
  );
};

export default TestRunner;



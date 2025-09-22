import { useMemo, useState, useEffect } from 'react';
import { executionApi } from '../../services/api';

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const TestRunner = ({ endpoints = [], projectId }) => {
  const first = endpoints[0];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [method, setMethod] = useState(first?.method || 'GET');
  const [path, setPath] = useState(first?.path || '/');
  const [headers, setHeaders] = useState('{"Content-Type":"application/json"}');
  const storageKey = projectId ? `devdeck:test:${projectId}` : 'devdeck:test:global';
  const [baseUrl, setBaseUrl] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw).baseUrl || '' : '';
    } catch { return ''; }
  });
  const [body, setBody] = useState('{}');
  const [resp, setResp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState({});

  const paramNames = useMemo(() => {
    const names = [];
    const re = /:([^/]+)/g;
    let m;
    const p = (endpoints[selectedIdx]?.path || path || '') + '';
    while ((m = re.exec(p)) !== null) names.push(m[1]);
    return names;
  }, [selectedIdx, endpoints, path]);

  const resolvedPath = useMemo(() => {
    let p = path || '';
    for (const name of paramNames) {
      const val = params[name] ?? '';
      p = p.replace(`:${name}`, encodeURIComponent(val));
    }
    return p;
  }, [path, params, paramNames]);

  const onRun = async () => {
    setLoading(true);
    setResp(null);
    try {
      const hdrs = JSON.parse(headers || '{}');
      const bdy = body && body.trim() ? JSON.parse(body) : null;
      // If a relative path is provided, prepend baseUrl; otherwise use absolute URL
      const url = resolvedPath.startsWith('http') ? resolvedPath : `${baseUrl || ''}${resolvedPath}`;
      const { data } = await executionApi.testEndpoint({
        url,
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

  // Persist settings
  const persist = () => {
    try { localStorage.setItem(storageKey, JSON.stringify({ baseUrl, method, path, headers, body })); } catch {}
  };
  
  // Auto-persist on key changes
  useEffect(() => { persist(); }, [baseUrl, method, path, headers, body]);

  const onSelectEndpoint = (idx) => {
    const ep = endpoints[idx];
    setSelectedIdx(idx);
    if (ep) {
      setMethod(ep.method || 'GET');
      setPath(ep.path || '/');
      // Initialize params with blanks
      const newParams = {};
      const re = /:([^/]+)/g;
      let m;
      while ((m = re.exec(ep.path || '')) !== null) newParams[m[1]] = '';
      setParams(newParams);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <label className="text-sm opacity-80">Base URL</label>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className="flex-1 px-2 py-1 border rounded"
          placeholder="http://127.0.0.1:PORT"
        />
      </div>
      {endpoints.length > 0 && (
        <div className="flex items-center space-x-2">
          <label className="text-sm opacity-80">Endpoint</label>
          <select
            value={selectedIdx}
            onChange={(e) => onSelectEndpoint(Number(e.target.value))}
            className="px-2 py-1 border rounded flex-1 bg-white text-black"
          >
            {endpoints.map((ep, i) => (
              <option key={`${ep.method}-${ep.path}-${i}`} value={i}>
                {ep.method} {ep.path}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center space-x-2">
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-2 py-1 border rounded">
          {methods.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input value={path} onChange={(e) => setPath(e.target.value)} className="flex-1 px-2 py-1 border rounded" placeholder="http://localhost:3000/api/hello or /api/hello" />
        <button onClick={onRun} disabled={loading} className="px-3 py-1 rounded bg-indigo-600 text-white">{loading ? 'Testing...' : 'Send'}</button>
      </div>
      {paramNames.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {paramNames.map((name) => (
            <div key={name}>
              <div className="text-xs opacity-80 mb-1">Path param: {name}</div>
              <input
                value={params[name] ?? ''}
                onChange={(e) => setParams((prev) => ({ ...prev, [name]: e.target.value }))}
                className="w-full px-2 py-1 border rounded"
                placeholder={name}
              />
            </div>
          ))}
        </div>
      )}
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
        <pre className="w-full border rounded p-2 bg-gray-50 text-black overflow-auto text-sm">{resp ? JSON.stringify(resp, null, 2) : 'No response yet.'}</pre>
      </div>
    </div>
  );
};

export default TestRunner;



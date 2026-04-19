import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  PaperAirplaneIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { executionApi } from '../../services/api';

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const methodStyles = {
  GET: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  POST: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  PUT: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  PATCH: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  DELETE: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const getJsonState = (value, allowEmpty = false) => {
  if (allowEmpty && !value.trim()) return { valid: true, parsed: null };

  try {
    return { valid: true, parsed: JSON.parse(value || '{}') };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

const formatJson = (value, fallback) => {
  const state = getJsonState(value, true);
  return state.valid ? JSON.stringify(state.parsed ?? fallback, null, 2) : value;
};

const TestRunner = ({ endpoints = [], projectId }) => {
  const storageKey = projectId ? `devdeck:test:${projectId}` : 'devdeck:test:global';
  const savedSettings = useMemo(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [storageKey]);

  const firstEndpoint = endpoints[0];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [method, setMethod] = useState(savedSettings.method || firstEndpoint?.method || 'GET');
  const [path, setPath] = useState(savedSettings.path || firstEndpoint?.path || '/');
  const [headers, setHeaders] = useState(savedSettings.headers || '{\n  "Content-Type": "application/json"\n}');
  const [baseUrl, setBaseUrl] = useState(savedSettings.baseUrl || '');
  const [body, setBody] = useState(savedSettings.body || '{}');
  const [params, setParams] = useState(savedSettings.params || {});
  const [response, setResponse] = useState(null);
  const [history, setHistory] = useState(savedSettings.history || []);
  const [loading, setLoading] = useState(false);

  const paramNames = useMemo(() => {
    const names = [];
    const re = /:([^/]+)/g;
    let match;
    const sourcePath = `${path || ''}`;

    while ((match = re.exec(sourcePath)) !== null) {
      names.push(match[1]);
    }

    return names;
  }, [path]);

  const resolvedPath = useMemo(() => {
    let nextPath = path || '';
    for (const name of paramNames) {
      nextPath = nextPath.replace(`:${name}`, encodeURIComponent(params[name] ?? ''));
    }
    return nextPath;
  }, [path, params, paramNames]);

  const requestUrl = useMemo(() => {
    if (!resolvedPath) return '';
    if (/^https?:\/\//i.test(resolvedPath)) return resolvedPath;
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedPath = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
    return `${normalizedBase}${normalizedPath}`;
  }, [baseUrl, resolvedPath]);

  const headerState = getJsonState(headers);
  const bodyState = getJsonState(body, ['GET', 'DELETE'].includes(method));
  const urlIsValid = /^https?:\/\//i.test(requestUrl);
  const canSend = urlIsValid && headerState.valid && bodyState.valid && !loading;

  const persist = useCallback(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          baseUrl,
          method,
          path,
          headers,
          body,
          params,
          history: history.slice(0, 8),
        })
      );
    } catch {
      /* ignore quota */
    }
  }, [baseUrl, body, headers, history, method, params, path, storageKey]);

  useEffect(() => {
    persist();
  }, [persist]);

  useEffect(() => {
    if (!endpoints.length) return;
    const endpoint = endpoints[selectedIdx] || endpoints[0];
    if (!endpoint) return;

    setMethod(endpoint.method || 'GET');
    setPath(endpoint.path || '/');

    const nextParams = {};
    const re = /:([^/]+)/g;
    let match;
    while ((match = re.exec(endpoint.path || '')) !== null) {
      nextParams[match[1]] = params[match[1]] || '';
    }
    setParams(nextParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- endpoint selection should not reset from param typing
  }, [selectedIdx, endpoints]);

  const handleRun = async () => {
    if (!canSend) return;

    setLoading(true);
    setResponse(null);
    const startedAt = performance.now();

    try {
      const { data } = await executionApi.testEndpoint({
        url: requestUrl,
        method,
        headers: headerState.parsed,
        body: ['GET', 'DELETE'].includes(method) ? null : bodyState.parsed,
      });
      const durationMs = Math.round(performance.now() - startedAt);
      const nextResponse = { ...data, durationMs, url: requestUrl, method };

      setResponse(nextResponse);
      setHistory((items) => [
        {
          id: `request-${Date.now()}`,
          method,
          url: requestUrl,
          status: data.status,
          durationMs,
          at: new Date().toISOString(),
        },
        ...items,
      ].slice(0, 8));
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      const nextResponse = {
        error: error.message || 'Failed to run request',
        durationMs,
        url: requestUrl,
        method,
      };
      setResponse(nextResponse);
      setHistory((items) => [
        {
          id: `request-${Date.now()}`,
          method,
          url: requestUrl,
          status: 'ERR',
          durationMs,
          at: new Date().toISOString(),
        },
        ...items,
      ].slice(0, 8));
    } finally {
      setLoading(false);
    }
  };

  const selectHistoryItem = (item) => {
    setMethod(item.method);
    setPath(item.url);
  };

  const statusOk = response?.status >= 200 && response?.status < 300;
  const statusLabel = response?.status ? `${response.status} ${response.statusText || ''}`.trim() : response?.error ? 'Request failed' : 'Not sent';

  return (
    <div className="h-full overflow-auto bg-[#111113] p-4 text-[#e4e4e7]">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-base font-semibold">Endpoint Tester</h3>
          <p className="text-sm text-[#a1a1aa]">Send requests against a running project server and inspect status, headers, timing, and response data.</p>
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={!canSend}
          className="inline-flex w-fit items-center rounded-md bg-[#0ea5e9] px-3 py-2 text-sm font-medium text-white hover:bg-[#0284c7] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" /> : <PaperAirplaneIcon className="mr-2 h-4 w-4" />}
          {loading ? 'Sending...' : 'Send request'}
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_360px]">
        <aside className="rounded-md border border-[#2b2b30] bg-[#18181b]">
          <div className="border-b border-[#2b2b30] px-3 py-2">
            <p className="text-sm font-semibold">Detected endpoints</p>
            <p className="text-xs text-[#858585]">{endpoints.length || 0} from route scan</p>
          </div>
          <div className="max-h-[34rem] space-y-1 overflow-auto p-2">
            {endpoints.length ? (
              endpoints.map((endpoint, index) => (
                <button
                  key={`${endpoint.method}-${endpoint.path}-${index}`}
                  type="button"
                  onClick={() => setSelectedIdx(index)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                    selectedIdx === index
                      ? 'bg-[#2d2d30] text-[#f4f4f5]'
                      : 'text-[#a1a1aa] hover:bg-[#242428] hover:text-[#e4e4e7]'
                  }`}
                >
                  <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${methodStyles[endpoint.method] || methodStyles.GET}`}>
                    {endpoint.method || 'GET'}
                  </span>
                  <span className="min-w-0 truncate font-mono text-xs">{endpoint.path}</span>
                </button>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-[#3c3c3c] p-3 text-sm text-[#858585]">
                Run code first to scan Express routes, or enter a path manually.
              </p>
            )}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="rounded-md border border-[#2b2b30] bg-[#18181b] p-3">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#858585]">Base URL</label>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              className="w-full rounded-md border border-[#3c3c3c] bg-[#111113] px-3 py-2 text-sm text-[#f4f4f5] placeholder-[#71717a] focus:border-[#38bdf8] focus:outline-none"
              placeholder="http://127.0.0.1:PORT"
            />
            <p className={`mt-2 truncate text-xs ${urlIsValid || !requestUrl ? 'text-[#858585]' : 'text-amber-300'}`}>
              Request URL: {requestUrl || 'Add a base URL and path'}
              {!urlIsValid && requestUrl ? ' - absolute URL required' : ''}
            </p>
          </div>

          <div className="rounded-md border border-[#2b2b30] bg-[#18181b] p-3">
            <div className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)]">
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="rounded-md border border-[#3c3c3c] bg-[#111113] px-3 py-2 text-sm text-[#f4f4f5] focus:border-[#38bdf8] focus:outline-none"
              >
                {methods.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <input
                value={path}
                onChange={(event) => setPath(event.target.value)}
                className="rounded-md border border-[#3c3c3c] bg-[#111113] px-3 py-2 font-mono text-sm text-[#f4f4f5] placeholder-[#71717a] focus:border-[#38bdf8] focus:outline-none"
                placeholder="/api/hello or http://localhost:3000/api/hello"
              />
            </div>
          </div>

          {paramNames.length > 0 && (
            <div className="rounded-md border border-[#2b2b30] bg-[#18181b] p-3">
              <p className="mb-2 text-sm font-semibold">Path parameters</p>
              <div className="grid gap-2 md:grid-cols-3">
                {paramNames.map((name) => (
                  <label key={name} className="block">
                    <span className="mb-1 block text-xs text-[#858585]">{name}</span>
                    <input
                      value={params[name] ?? ''}
                      onChange={(event) => setParams((prev) => ({ ...prev, [name]: event.target.value }))}
                      className="w-full rounded-md border border-[#3c3c3c] bg-[#111113] px-3 py-2 text-sm text-[#f4f4f5] focus:border-[#38bdf8] focus:outline-none"
                      placeholder={name}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-[#2b2b30] bg-[#18181b]">
              <div className="flex items-center justify-between border-b border-[#2b2b30] px-3 py-2">
                <p className="text-sm font-semibold">Headers</p>
                <button type="button" onClick={() => setHeaders(formatJson(headers, {}))} className="text-xs text-sky-300 hover:text-sky-200">Format</button>
              </div>
              <textarea
                value={headers}
                onChange={(event) => setHeaders(event.target.value)}
                rows={8}
                className="w-full resize-y bg-[#111113] p-3 font-mono text-xs leading-relaxed text-[#d4d4d8] outline-none"
              />
              {!headerState.valid && <p className="border-t border-red-500/30 px-3 py-2 text-xs text-red-300">{headerState.error}</p>}
            </div>

            <div className="rounded-md border border-[#2b2b30] bg-[#18181b]">
              <div className="flex items-center justify-between border-b border-[#2b2b30] px-3 py-2">
                <p className="text-sm font-semibold">Body</p>
                <button type="button" onClick={() => setBody(formatJson(body, {}))} className="text-xs text-sky-300 hover:text-sky-200">Format</button>
              </div>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                disabled={['GET', 'DELETE'].includes(method)}
                rows={8}
                className="w-full resize-y bg-[#111113] p-3 font-mono text-xs leading-relaxed text-[#d4d4d8] outline-none disabled:text-[#71717a]"
              />
              {!bodyState.valid && <p className="border-t border-red-500/30 px-3 py-2 text-xs text-red-300">{bodyState.error}</p>}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border border-[#2b2b30] bg-[#18181b]">
            <div className="flex items-center justify-between border-b border-[#2b2b30] px-3 py-2">
              <p className="text-sm font-semibold">Response</p>
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${
                response?.error ? 'border-red-500/30 bg-red-500/15 text-red-300' :
                  response ? (statusOk ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300' : 'border-amber-500/30 bg-amber-500/15 text-amber-300') :
                    'border-[#3c3c3c] bg-[#2d2d30] text-[#a1a1aa]'
              }`}>
                {response?.error ? <XCircleIcon className="mr-1 h-3.5 w-3.5" /> : response ? <CheckCircleIcon className="mr-1 h-3.5 w-3.5" /> : null}
                {statusLabel}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 border-b border-[#2b2b30] p-3 text-xs text-[#a1a1aa]">
              <div className="rounded-md bg-[#111113] p-2">
                <p className="text-[#71717a]">Time</p>
                <p className="mt-1 font-semibold text-[#e4e4e7]">{response?.durationMs ?? '-'} ms</p>
              </div>
              <div className="rounded-md bg-[#111113] p-2">
                <p className="text-[#71717a]">Method</p>
                <p className="mt-1 font-semibold text-[#e4e4e7]">{response?.method || method}</p>
              </div>
            </div>
            <pre className="max-h-[28rem] overflow-auto bg-[#0f172a] p-3 text-xs leading-relaxed text-[#d4d4d8]">
              {response ? JSON.stringify(response.error ? response : response.data, null, 2) : 'No response yet.'}
            </pre>
          </section>

          <section className="rounded-md border border-[#2b2b30] bg-[#18181b]">
            <div className="border-b border-[#2b2b30] px-3 py-2">
              <p className="text-sm font-semibold">History</p>
              <p className="text-xs text-[#858585]">Recent requests on this project</p>
            </div>
            <div className="max-h-64 space-y-1 overflow-auto p-2">
              {history.length ? (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectHistoryItem(item)}
                    className="w-full rounded-md px-2 py-2 text-left hover:bg-[#242428]"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${methodStyles[item.method] || methodStyles.GET}`}>{item.method}</span>
                      <span className="truncate font-mono text-xs text-[#d4d4d8]">{item.url}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[#858585]">
                      <span>{item.status}</span>
                      <ClockIcon className="h-3.5 w-3.5" />
                      <span>{item.durationMs}ms</span>
                    </div>
                  </button>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-[#3c3c3c] p-3 text-sm text-[#858585]">No requests yet.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default TestRunner;

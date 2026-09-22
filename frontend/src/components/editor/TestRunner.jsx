import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  ArrowPathIcon,
  BeakerIcon,
  CheckCircleIcon,
  ClockIcon,
  CommandLineIcon,
  DocumentDuplicateIcon,
  PaperAirplaneIcon,
  ServerStackIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { executionApi, projectsApi } from '../../services/api';

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const responseViews = ['body', 'headers', 'meta'];

const methodStyles = {
  GET: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  POST: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  PUT: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  PATCH: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  DELETE: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const basePanelClass = 'rounded-md border border-[#2b2b30] bg-[#18181b]';
const inputClass =
  'w-full rounded-md border border-[#3c3c3c] bg-[#111113] px-3 py-2 text-sm text-[#f4f4f5] placeholder-[#71717a] focus:border-[#38bdf8] focus:outline-none';
const mutedTextClass = 'text-[#a1a1aa]';

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

const splitUrl = (value) => {
  try {
    const parsed = new URL(value);
    return {
      baseUrl: `${parsed.protocol}//${parsed.host}`,
      path: `${parsed.pathname}${parsed.search}`,
    };
  } catch {
    return null;
  }
};

const getResponseBodyText = (response) => {
  if (!response) return 'No response yet.';

  if (response.error) {
    return JSON.stringify(response, null, 2);
  }

  return JSON.stringify(response.data, null, 2);
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
  const [projectServerUrl, setProjectServerUrl] = useState('');
  const [body, setBody] = useState(savedSettings.body || '{}');
  const [params, setParams] = useState(savedSettings.params || {});
  const [response, setResponse] = useState(null);
  const [history, setHistory] = useState(savedSettings.history || []);
  const [loading, setLoading] = useState(false);
  const [responseView, setResponseView] = useState('body');

  const paramNames = useMemo(() => {
    const names = [];
    const re = /:([^/?]+)/g;
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
    if (!baseUrl) return '';
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedPath = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
    return `${normalizedBase}${normalizedPath}`;
  }, [baseUrl, resolvedPath]);

  const headerState = getJsonState(headers);
  const bodyState = getJsonState(body, ['GET', 'DELETE'].includes(method));
  const urlIsValid = /^https?:\/\//i.test(requestUrl);
  const canSend = urlIsValid && headerState.valid && bodyState.valid && !loading;
  const selectedEndpoint = endpoints[selectedIdx] || null;

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
          history: history.slice(0, 10),
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
    if (!projectId) return undefined;

    let cancelled = false;

    projectsApi
      .getById(projectId)
      .then((responseData) => {
        if (cancelled) return;
        const runPort = responseData.data?.runPort;
        const nextServerUrl = runPort ? `http://127.0.0.1:${runPort}` : '';
        setProjectServerUrl(nextServerUrl);

        if (!savedSettings.baseUrl && nextServerUrl) {
          setBaseUrl(nextServerUrl);
        }
      })
      .catch((error) => {
        console.error('Could not load project server details:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, savedSettings.baseUrl]);

  useEffect(() => {
    if (!endpoints.length) return;
    const endpoint = endpoints[selectedIdx] || endpoints[0];
    if (!endpoint) return;

    setMethod(endpoint.method || 'GET');
    setPath(endpoint.path || '/');

    const nextParams = {};
    const re = /:([^/?]+)/g;
    let match;
    while ((match = re.exec(endpoint.path || '')) !== null) {
      nextParams[match[1]] = params[match[1]] || '';
    }
    setParams(nextParams);
    setResponse(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- endpoint switching should not replay every param edit
  }, [selectedIdx, endpoints]);

  const handleRun = async () => {
    if (!canSend) return;

    setLoading(true);
    setResponse(null);
    const startedAt = performance.now();

    try {
      const requestBody = ['GET', 'DELETE'].includes(method) ? null : bodyState.parsed;
      const { data } = await executionApi.testEndpoint({
        url: requestUrl,
        method,
        headers: headerState.parsed,
        body: requestBody,
      });

      const durationMs = Math.round(performance.now() - startedAt);
      const nextResponse = { ...data, durationMs, url: requestUrl, method };

      setResponse(nextResponse);
      setResponseView('body');
      setHistory((items) =>
        [
          {
            id: `request-${Date.now()}`,
            method,
            url: requestUrl,
            path,
            baseUrl,
            params,
            headers,
            body,
            status: data.status,
            durationMs,
            at: new Date().toISOString(),
          },
          ...items,
        ].slice(0, 10)
      );
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      const nextResponse = {
        error: error.data?.message || error.message || 'Failed to run request',
        details: error.data,
        durationMs,
        url: requestUrl,
        method,
      };
      setResponse(nextResponse);
      setResponseView('body');
      setHistory((items) =>
        [
          {
            id: `request-${Date.now()}`,
            method,
            url: requestUrl,
            path,
            baseUrl,
            params,
            headers,
            body,
            status: 'ERR',
            durationMs,
            at: new Date().toISOString(),
          },
          ...items,
        ].slice(0, 10)
      );
    } finally {
      setLoading(false);
    }
  };

  const selectHistoryItem = (item) => {
    setMethod(item.method || 'GET');

    const parsed = splitUrl(item.url);
    if (parsed) {
      setBaseUrl(parsed.baseUrl);
      setPath(item.path || parsed.path);
    } else {
      setPath(item.path || item.url || '/');
    }

    if (item.baseUrl) setBaseUrl(item.baseUrl);
    if (item.params) setParams(item.params);
    if (item.headers) setHeaders(item.headers);
    if (item.body) setBody(item.body);
  };

  const handleUseProjectServer = () => {
    if (projectServerUrl) {
      setBaseUrl(projectServerUrl);
    }
  };

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error('Could not copy test output:', error);
    }
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const statusOk = response?.status >= 200 && response?.status < 300;
  const statusLabel = response?.status
    ? `${response.status} ${response.statusText || ''}`.trim()
    : response?.error
      ? 'Request failed'
      : 'Not sent';

  const responseText =
    responseView === 'headers'
      ? JSON.stringify(response?.headers || {}, null, 2)
      : responseView === 'meta'
        ? JSON.stringify(
            response
              ? {
                  url: response.url,
                  method: response.method,
                  durationMs: response.durationMs,
                  status: response.status ?? null,
                  statusText: response.statusText ?? null,
                }
              : {},
            null,
            2
          )
        : getResponseBodyText(response);

  return (
    <div className="h-full overflow-auto bg-[#111113] p-4 text-[#e4e4e7]">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h3 className="text-base font-semibold">Endpoint Tester</h3>
          <p className="text-sm text-[#a1a1aa]">
            Run live requests against the project server, restore recent calls, and inspect body, headers, and timing without leaving Dev Deck.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full border px-2.5 py-1 ${projectServerUrl ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-[#3c3c3c] bg-[#18181b] text-[#a1a1aa]'}`}>
            {projectServerUrl ? `Project server ${projectServerUrl}` : 'No detected run port yet'}
          </span>
          <span className={`rounded-full border px-2.5 py-1 ${canSend ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
            {canSend ? 'Request ready' : 'Request needs attention'}
          </span>
          <button
            type="button"
            onClick={handleRun}
            disabled={!canSend}
            className="inline-flex items-center rounded-md bg-[#0ea5e9] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#0284c7] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" /> : <PaperAirplaneIcon className="mr-2 h-4 w-4" />}
            {loading ? 'Sending...' : 'Send request'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_380px]">
        <aside className={basePanelClass}>
          <div className="border-b border-[#2b2b30] px-3 py-3">
            <div className="flex items-center gap-2">
              <BeakerIcon className="h-4 w-4 text-sky-400" />
              <p className="text-sm font-semibold">Detected endpoints</p>
            </div>
            <p className="mt-1 text-xs text-[#858585]">{endpoints.length || 0} routes from the latest scan</p>
          </div>

          <div className="max-h-[36rem] space-y-2 overflow-auto p-2">
            {endpoints.length ? (
              endpoints.map((endpoint, index) => (
                <button
                  key={`${endpoint.method}-${endpoint.path}-${index}`}
                  type="button"
                  onClick={() => setSelectedIdx(index)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition ${
                    selectedIdx === index
                      ? 'border-sky-500/40 bg-sky-500/10'
                      : 'border-transparent bg-[#111113] hover:border-[#2b2b30]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${methodStyles[endpoint.method] || methodStyles.GET}`}>
                      {endpoint.method || 'GET'}
                    </span>
                    <span className="truncate font-mono text-xs text-[#d4d4d8]">{endpoint.path}</span>
                  </div>
                  {endpoint.description ? (
                    <p className="mt-2 line-clamp-2 text-xs text-[#858585]">{endpoint.description}</p>
                  ) : null}
                </button>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-[#3c3c3c] p-3 text-sm text-[#858585]">
                Run the project once to scan Express routes, or type a request manually.
              </p>
            )}
          </div>
        </aside>

        <section className="space-y-4">
          <div className={`${basePanelClass} p-3`}>
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold">Connection</p>
                <p className="text-xs text-[#858585]">Target the active server or override it with any API base URL.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {projectServerUrl ? (
                  <button
                    type="button"
                    onClick={handleUseProjectServer}
                    className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/15"
                  >
                    <ServerStackIcon className="mr-1.5 h-4 w-4" />
                    Use project server
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setBaseUrl('http://127.0.0.1:3000')}
                  className="rounded-md border border-[#3c3c3c] px-3 py-1.5 text-xs text-[#d4d4d8] transition hover:border-sky-500 hover:text-sky-300"
                >
                  Use localhost:3000
                </button>
              </div>
            </div>

            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#858585]">Base URL</label>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              className={inputClass}
              placeholder="http://127.0.0.1:PORT"
            />

            <div className="mt-3 rounded-md bg-[#111113] px-3 py-2 text-xs">
              <p className={`${mutedTextClass}`}>Request preview</p>
              <p className={`mt-1 break-all font-mono ${urlIsValid || !requestUrl ? 'text-[#d4d4d8]' : 'text-amber-300'}`}>
                {requestUrl || 'Add a base URL and request path'}
              </p>
            </div>
          </div>

          <div className={`${basePanelClass} p-3`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Request</p>
                <p className="text-xs text-[#858585]">
                  {selectedEndpoint ? `Using ${selectedEndpoint.method} ${selectedEndpoint.path}` : 'Compose a request manually or choose a detected route.'}
                </p>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)]">
              <select value={method} onChange={(event) => setMethod(event.target.value)} className={inputClass}>
                {methods.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input
                value={path}
                onChange={(event) => setPath(event.target.value)}
                className={`${inputClass} font-mono`}
                placeholder="/api/hello or http://localhost:3000/api/hello"
              />
            </div>

            {paramNames.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold">Path parameters</p>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {paramNames.map((name) => (
                    <label key={name} className="block">
                      <span className="mb-1 block text-xs text-[#858585]">{name}</span>
                      <input
                        value={params[name] ?? ''}
                        onChange={(event) => setParams((prev) => ({ ...prev, [name]: event.target.value }))}
                        className={inputClass}
                        placeholder={name}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={basePanelClass}>
              <div className="flex items-center justify-between border-b border-[#2b2b30] px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">Headers</p>
                  <p className="text-xs text-[#858585]">JSON object sent with the request.</p>
                </div>
                <button type="button" onClick={() => setHeaders(formatJson(headers, {}))} className="text-xs text-sky-300 hover:text-sky-200">
                  Format
                </button>
              </div>
              <textarea
                value={headers}
                onChange={(event) => setHeaders(event.target.value)}
                rows={10}
                className="w-full resize-y bg-[#111113] p-3 font-mono text-xs leading-relaxed text-[#d4d4d8] outline-none"
              />
              {!headerState.valid ? (
                <p className="border-t border-red-500/30 px-3 py-2 text-xs text-red-300">{headerState.error}</p>
              ) : null}
            </div>

            <div className={basePanelClass}>
              <div className="flex items-center justify-between border-b border-[#2b2b30] px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">Body</p>
                  <p className="text-xs text-[#858585]">
                    {['GET', 'DELETE'].includes(method) ? 'This method usually does not send a body.' : 'JSON payload sent with the request.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setBody(formatJson(body, {}))} className="text-xs text-sky-300 hover:text-sky-200">
                    Format
                  </button>
                  <button type="button" onClick={() => setBody('{}')} className="text-xs text-[#a1a1aa] hover:text-[#f4f4f5]">
                    Reset
                  </button>
                </div>
              </div>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                disabled={['GET', 'DELETE'].includes(method)}
                rows={10}
                className="w-full resize-y bg-[#111113] p-3 font-mono text-xs leading-relaxed text-[#d4d4d8] outline-none disabled:text-[#71717a]"
              />
              {!bodyState.valid ? (
                <p className="border-t border-red-500/30 px-3 py-2 text-xs text-red-300">{bodyState.error}</p>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className={basePanelClass}>
            <div className="flex items-center justify-between border-b border-[#2b2b30] px-3 py-2">
              <div>
                <p className="text-sm font-semibold">Response</p>
                <p className="text-xs text-[#858585]">Inspect the result body, headers, or request metadata.</p>
              </div>
              <span
                className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${
                  response?.error
                    ? 'border-red-500/30 bg-red-500/15 text-red-300'
                    : response
                      ? statusOk
                        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                        : 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                      : 'border-[#3c3c3c] bg-[#2d2d30] text-[#a1a1aa]'
                }`}
              >
                {response?.error ? <XCircleIcon className="mr-1 h-3.5 w-3.5" /> : response ? <CheckCircleIcon className="mr-1 h-3.5 w-3.5" /> : null}
                {statusLabel}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 border-b border-[#2b2b30] p-3 text-xs text-[#a1a1aa]">
              <div className="rounded-md bg-[#111113] p-2">
                <p className="text-[#71717a]">Time</p>
                <p className="mt-1 font-semibold text-[#e4e4e7]">{response?.durationMs ?? '-'} ms</p>
              </div>
              <div className="rounded-md bg-[#111113] p-2">
                <p className="text-[#71717a]">Method</p>
                <p className="mt-1 font-semibold text-[#e4e4e7]">{response?.method || method}</p>
              </div>
              <div className="rounded-md bg-[#111113] p-2">
                <p className="text-[#71717a]">URL</p>
                <p className="mt-1 truncate font-semibold text-[#e4e4e7]">{response?.url || requestUrl || '-'}</p>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-[#2b2b30] px-3 py-2">
              <div className="flex gap-2">
                {responseViews.map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setResponseView(view)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      responseView === view ? 'bg-sky-500/15 text-sky-300' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                    }`}
                  >
                    {view[0].toUpperCase() + view.slice(1)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(responseText)}
                className="inline-flex items-center text-xs text-sky-300 hover:text-sky-200"
              >
                <DocumentDuplicateIcon className="mr-1 h-3.5 w-3.5" />
                Copy
              </button>
            </div>

            <pre className="max-h-[30rem] overflow-auto bg-[#0f172a] p-3 text-xs leading-relaxed text-[#d4d4d8]">{responseText}</pre>
          </section>

          <section className={basePanelClass}>
            <div className="flex items-center justify-between border-b border-[#2b2b30] px-3 py-2">
              <div>
                <p className="text-sm font-semibold">History</p>
                <p className="text-xs text-[#858585]">Restore recent requests on this project.</p>
              </div>
              {history.length > 0 ? (
                <button type="button" onClick={clearHistory} className="text-xs text-[#a1a1aa] hover:text-[#f4f4f5]">
                  Clear
                </button>
              ) : null}
            </div>

            <div className="max-h-72 space-y-2 overflow-auto p-2">
              {history.length ? (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectHistoryItem(item)}
                    className="w-full rounded-md border border-transparent bg-[#111113] px-3 py-2 text-left transition hover:border-[#2b2b30]"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${methodStyles[item.method] || methodStyles.GET}`}>
                        {item.method}
                      </span>
                      <span className="truncate font-mono text-xs text-[#d4d4d8]">{item.url}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-[#858585]">
                      <span>{item.status}</span>
                      <span className="inline-flex items-center">
                        <ClockIcon className="mr-1 h-3.5 w-3.5" />
                        {item.durationMs}ms
                      </span>
                      <span>{new Date(item.at).toLocaleTimeString()}</span>
                    </div>
                  </button>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-[#3c3c3c] p-3 text-sm text-[#858585]">No requests yet.</p>
              )}
            </div>
          </section>

          <section className={basePanelClass}>
            <div className="border-b border-[#2b2b30] px-3 py-2">
              <p className="text-sm font-semibold">Request checklist</p>
            </div>
            <div className="space-y-2 p-3 text-sm">
              <div className="flex items-start gap-2">
                <CommandLineIcon className="mt-0.5 h-4 w-4 text-sky-400" />
                <p className={mutedTextClass}>Run the code once so Dev Deck can detect the project server and route list.</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 text-emerald-400" />
                <p className={mutedTextClass}>Use the detected endpoint list as a starting point, then adjust headers or payloads as needed.</p>
              </div>
              <div className="flex items-start gap-2">
                <ArrowPathIcon className="mt-0.5 h-4 w-4 text-amber-400" />
                <p className={mutedTextClass}>Restore a request from history when you want to rerun a regression check.</p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default TestRunner;

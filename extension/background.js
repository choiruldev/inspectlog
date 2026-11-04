// Chrome Extension Manifest V3 Service Worker: Chrome Debugger API for Deep Inspection

const activeSessions = new Map(); // tabId -> { requests, consoleLogs, attached }

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_RECORDING") {
    const tabId = message.tabId;
    startRecording(tabId)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "STOP_RECORDING") {
    const tabId = message.tabId;
    stopRecording(tabId)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "GET_STATUS") {
    const tabId = message.tabId;
    const session = activeSessions.get(tabId);
    sendResponse({
      recording: !!session?.attached,
      requestsCount: session?.requests ? Object.keys(session.requests).length : 0,
      errorsCount: session?.requests ? Object.values(session.requests).filter((r) => r.isError).length : 0,
      consoleCount: session?.consoleLogs ? session.consoleLogs.length : 0,
    });
    return false;
  }
});

async function startRecording(tabId) {
  if (activeSessions.get(tabId)?.attached) return;

  const session = {
    attached: true,
    requests: {},
    consoleLogs: [],
  };
  activeSessions.set(tabId, session);

  await chrome.debugger.attach({ tabId }, "1.3");
  await chrome.debugger.sendCommand({ tabId }, "Network.enable");
  await chrome.debugger.sendCommand({ tabId }, "Console.enable");
  await chrome.debugger.sendCommand({ tabId }, "Runtime.enable");
}

async function stopRecording(tabId) {
  const session = activeSessions.get(tabId);
  if (!session) return { requests: [], consoleLogs: [] };

  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // ignore
  }

  activeSessions.delete(tabId);
  return {
    requests: Object.values(session.requests),
    consoleLogs: session.consoleLogs,
  };
}

chrome.debugger.onEvent.addListener(async (source, method, params) => {
  const tabId = source.tabId;
  const session = activeSessions.get(tabId);
  if (!session) return;

  if (method === "Network.requestWillBeSent") {
    const { requestId, request, timestamp } = params;
    session.requests[requestId] = {
      id: requestId,
      url: request.url,
      method: request.method,
      requestHeaders: request.headers,
      requestPayload: request.postData || null,
      status: null,
      responseHeaders: {},
      responseBody: null,
      isError: false,
      timestamp,
    };
  }

  if (method === "Network.responseReceived") {
    const { requestId, response } = params;
    const req = session.requests[requestId];
    if (req) {
      req.status = response.status;
      req.responseHeaders = response.headers;
      req.isError = response.status >= 400;

      // Try get response body
      try {
        const bodyObj = await chrome.debugger.sendCommand(
          { tabId },
          "Network.getResponseBody",
          { requestId }
        );
        req.responseBody = bodyObj.body;
      } catch {
        req.responseBody = null;
      }
    }
  }

  if (method === "Network.loadingFailed") {
    const { requestId, errorText } = params;
    const req = session.requests[requestId];
    if (req) {
      req.failed = true;
      req.failureReason = errorText;
      req.isError = true;
    }
  }

  if (method === "Console.messageAdded") {
    session.consoleLogs.push({
      type: params.message.level,
      text: params.message.text,
      url: params.message.url,
      line: params.message.line,
      timestamp: Date.now(),
    });
  }
});

let activeTabId = null;
let isRecording = false;
let lastCapturedData = null;

const toggleBtn = document.getElementById("toggleBtn");
const exportBtn = document.getElementById("exportBtn");
const badge = document.getElementById("badge");
const urlText = document.getElementById("urlText");
const reqCount = document.getElementById("reqCount");
const errCount = document.getElementById("errCount");

// Get current active tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    activeTabId = tabs[0].id;
    urlText.innerText = tabs[0].url || "Halaman kosong";

    chrome.runtime.sendMessage({ type: "GET_STATUS", tabId: activeTabId }, (status) => {
      if (status?.recording) {
        setRecordingState(true);
        reqCount.innerText = status.requestsCount || 0;
        errCount.innerText = status.errorsCount || 0;
      }
    });
  }
});

function setRecordingState(recording) {
  isRecording = recording;
  if (recording) {
    badge.innerText = "RECORDING";
    badge.className = "status-badge status-rec";
    toggleBtn.innerHTML = "<span>■ Berhenti & Kumpulkan Data</span>";
    toggleBtn.className = "btn btn-stop";
    exportBtn.style.display = "none";
  } else {
    badge.innerText = "IDLE";
    badge.className = "status-badge status-idle";
    toggleBtn.innerHTML = "<span>● Mulai Rekam Traffic</span>";
    toggleBtn.className = "btn btn-record";
  }
}

toggleBtn.addEventListener("click", () => {
  if (!activeTabId) return;

  if (!isRecording) {
    chrome.runtime.sendMessage({ type: "START_RECORDING", tabId: activeTabId }, (res) => {
      if (res?.success) {
        setRecordingState(true);
      } else {
        alert("Gagal memulai recording: " + (res?.error || "Error tidak diketahui"));
      }
    });
  } else {
    chrome.runtime.sendMessage({ type: "STOP_RECORDING", tabId: activeTabId }, (res) => {
      if (res?.success) {
        setRecordingState(false);
        lastCapturedData = res.data;
        const totalReq = res.data.requests.length;
        const totalErr = res.data.requests.filter((r) => r.isError).length;
        reqCount.innerText = totalReq;
        errCount.innerText = totalErr;

        if (totalReq > 0) {
          exportBtn.style.display = "flex";
        }
      }
    });
  }
});

exportBtn.addEventListener("click", () => {
  if (!lastCapturedData) return;
  const blob = new Blob([JSON.stringify(lastCapturedData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `extension-inspect-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

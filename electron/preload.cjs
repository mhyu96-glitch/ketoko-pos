const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  version: "1.0.0",
  lan: {
    getStatus: () => ipcRenderer.invoke("lan:getStatus"),
    start: (port) => ipcRenderer.invoke("lan:start", port),
    stop: () => ipcRenderer.invoke("lan:stop")
  }
});

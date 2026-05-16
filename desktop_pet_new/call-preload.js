const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  callResponse: (response) => ipcRenderer.send('call-response', response),
  getCallInfo: () => ipcRenderer.invoke('get-call-info'),
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  setBackgroundColor: (hex) => ipcRenderer.invoke('set-background-color', hex),
});

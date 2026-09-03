import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('clinicaDor', {
  downloadGoogleSheet: (url: string) => ipcRenderer.invoke('google-sheet:download', url),
  saveReportPdf: (payload: unknown) => ipcRenderer.invoke('report:save-pdf', payload),
});

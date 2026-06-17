import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipcChannels'

contextBridge.exposeInMainWorld('linea', {
  toggleClickThrough: () => ipcRenderer.invoke(IPC.TOGGLE_CLICK_THROUGH),
  getClickThroughState: () => ipcRenderer.invoke(IPC.GET_CLICK_THROUGH_STATE)
})

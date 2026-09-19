const {
  contextBridge,
  ipcRenderer
} = require("electron");


contextBridge.exposeInMainWorld(
  "spotify",
  {

    getNowPlaying: () =>
      ipcRenderer.invoke(
        "spotify-now-playing"
      )

  }
);
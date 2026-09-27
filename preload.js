const {
  contextBridge,
  ipcRenderer
} = require("electron");


/*
==================================================
SPOTIFY
==================================================
*/

contextBridge.exposeInMainWorld(
  "spotify",
  {

    getNowPlaying: () =>
      ipcRenderer.invoke(
        "spotify-now-playing"
      )

  }
);
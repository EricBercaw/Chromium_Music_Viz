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


/*
==================================================
APPLE TV CASTING
==================================================
*/

contextBridge.exposeInMainWorld(
  "casting",
  {

    start: () =>
      ipcRenderer.invoke(
        "cast-start"
      ),


    stop: () =>
      ipcRenderer.invoke(
        "cast-stop"
      ),


    status: () =>
      ipcRenderer.invoke(
        "cast-status"
      )

  }
);
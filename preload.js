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

    getNowPlaying:
      () =>
        ipcRenderer.invoke(
          "spotify-now-playing"
        )

  }
);


/*
==================================================
LIVE SYSTEM AUDIO
==================================================
*/

contextBridge.exposeInMainWorld(
  "systemAudio",
  {

    /*
    Start parec.
    */

    start:
      () =>
        ipcRenderer.invoke(
          "audio-start"
        ),


    /*
    Stop parec.
    */

    stop:
      () =>
        ipcRenderer.invoke(
          "audio-stop"
        ),


    /*
    Receive PCM chunks.
    */

    onData:
      (callback) => {

        const handler =
          (
            event,
            data
          ) => {

            callback(
              data
            );

          };


        ipcRenderer.on(
          "audio-pcm-data",
          handler
        );


        /*
        Return cleanup function.
        */

        return () => {

          ipcRenderer.removeListener(
            "audio-pcm-data",
            handler
          );

        };

      },


    /*
    parec error.
    */

    onError:
      (callback) => {

        const handler =
          (
            event,
            message
          ) => {

            callback(
              message
            );

          };


        ipcRenderer.on(
          "audio-capture-error",
          handler
        );


        return () => {

          ipcRenderer.removeListener(
            "audio-capture-error",
            handler
          );

        };

      },


    /*
    parec stopped unexpectedly.
    */

    onStopped:
      (callback) => {

        const handler =
          (
            event,
            details
          ) => {

            callback(
              details
            );

          };


        ipcRenderer.on(
          "audio-capture-stopped",
          handler
        );


        return () => {

          ipcRenderer.removeListener(
            "audio-capture-stopped",
            handler
          );

        };

      }

  }
);
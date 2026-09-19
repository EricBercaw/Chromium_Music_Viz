const {
  app,
  BrowserWindow,
  session,
  ipcMain
} = require("electron");

const path = require("path");

const {
  execFile,
  spawn
} = require("child_process");

const {
  promisify
} = require("util");

const execFileAsync =
  promisify(execFile);


/*
==================================================
USER SETTINGS
==================================================
*/

/*
Set this to true if you want the app to
automatically cast when it launches.

false = use the Cast button
true  = automatically cast on launch
*/

const AUTO_CAST = false;


/*
Your Doubletake executable.
*/

const DOUBLETAKE_PATH =
  "/home/ericb/doubletake/bin/doubletake";


/*
Your Living Room Apple TV.
*/

const APPLE_TV_IP =
  "192.168.86.21";


/*
==================================================
AIRPLAY / DOUBLETAKE
==================================================
*/

let castProcess = null;

let castStatus =
  "stopped";


function startCasting() {

  /*
  Don't launch multiple Doubletake processes.
  */

  if (
    castProcess &&
    castStatus !== "stopped"
  ) {

    return {
      success: true,
      status: castStatus
    };

  }


  try {

    castStatus =
      "starting";


    castProcess =
      spawn(
        DOUBLETAKE_PATH,
        [
          "-target",
          APPLE_TV_IP,

          "-no-audio",

          "-hwaccel",
          "none",

          "-fps",
          "30",

          "-bitrate",
          "4500"
        ],
        {

          cwd:
            path.dirname(
              DOUBLETAKE_PATH
            ),

          stdio: [
            "ignore",
            "pipe",
            "pipe"
          ]

        }
      );


    /*
    The process successfully launched.
    */

    castProcess.on(
      "spawn",
      () => {

        console.log(
          "Doubletake launched."
        );

      }
    );


    /*
    Doubletake may print normal information
    to stdout.
    */

    castProcess.stdout.on(
      "data",
      data => {

        const text =
          data.toString();

        console.log(
          "[Doubletake]",
          text.trim()
        );


        if (
          text.includes("connected") ||
          text.includes("stream") ||
          text.includes("capture")
        ) {

          castStatus =
            "casting";

        }

      }
    );


    /*
    Doubletake also writes many normal
    status messages to stderr.
    */

    castProcess.stderr.on(
      "data",
      data => {

        const text =
          data.toString();

        console.log(
          "[Doubletake]",
          text.trim()
        );


        if (
          text.includes(
            "FairPlay setup complete"
          ) ||
          text.includes(
            "connected to"
          ) ||
          text.includes(
            "screen capture"
          ) ||
          text.includes(
            "stream"
          )
        ) {

          castStatus =
            "casting";

        }

      }
    );


    castProcess.on(
      "error",
      error => {

        console.error(
          "Doubletake error:",
          error
        );


        castStatus =
          "stopped";

        castProcess =
          null;

      }
    );


    castProcess.on(
      "exit",
      code => {

        console.log(
          "Doubletake exited with code:",
          code
        );


        castStatus =
          "stopped";

        castProcess =
          null;

      }
    );


    return {

      success: true,

      status:
        castStatus

    };


  } catch (error) {

    console.error(
      "Could not start casting:",
      error
    );


    castStatus =
      "stopped";

    castProcess =
      null;


    return {

      success: false,

      status:
        castStatus,

      error:
        error.message

    };

  }

}


/*
==================================================
STOP AIRPLAY
==================================================
*/

function stopCasting() {

  if (
    castProcess
  ) {

    try {

      castProcess.kill(
        "SIGTERM"
      );

    } catch (error) {

      console.error(
        "Could not stop Doubletake:",
        error
      );

    }

  }


  castProcess =
    null;


  castStatus =
    "stopped";


  return {

    success: true,

    status:
      castStatus

  };

}


/*
==================================================
CAST IPC
==================================================
*/

ipcMain.handle(
  "cast-start",
  async () => {

    return startCasting();

  }
);


ipcMain.handle(
  "cast-stop",
  async () => {

    return stopCasting();

  }
);


ipcMain.handle(
  "cast-status",
  async () => {

    return {

      status:
        castStatus

    };

  }
);


/*
==================================================
SPOTIFY
==================================================
*/

async function getSpotifyNowPlaying() {

  try {

    const separator =
      "__MVSEP__";


    const metadataFormat =
      [
        "{{title}}",
        "{{artist}}",
        "{{album}}",
        "{{mpris:artUrl}}",
        "{{mpris:length}}"
      ].join(
        separator
      );


    /*
    Grab metadata, position and status.
    */

    const [
      metadataResult,
      positionResult,
      statusResult
    ] =
      await Promise.all([


        execFileAsync(
          "playerctl",
          [
            "--player=spotify",
            "metadata",
            "--format",
            metadataFormat
          ]
        ),


        execFileAsync(
          "playerctl",
          [
            "--player=spotify",
            "position"
          ]
        ),


        execFileAsync(
          "playerctl",
          [
            "--player=spotify",
            "status"
          ]
        )


      ]);


    const metadata =
      metadataResult.stdout
        .trim()
        .split(
          separator
        );


    const title =
      metadata[0] || "";


    const artist =
      metadata[1] || "";


    const album =
      metadata[2] || "";


    const artUrl =
      metadata[3] || "";


    /*
    MPRIS length is microseconds.
    */

    const durationUs =
      Number(
        metadata[4]
      ) || 0;


    /*
    playerctl position is seconds.
    */

    const positionSeconds =
      Number(
        positionResult.stdout.trim()
      ) || 0;


    const status =
      statusResult.stdout.trim();


    return {

      available:
        true,

      title,

      artist,

      album,

      artUrl,

      durationMs:
        durationUs /
        1000,

      positionMs:
        positionSeconds *
        1000,

      status,

      isPlaying:
        status ===
        "Playing"

    };


  } catch (error) {

    return {

      available:
        false

    };

  }

}


/*
==================================================
SPOTIFY IPC
==================================================
*/

ipcMain.handle(
  "spotify-now-playing",
  async () => {

    return await getSpotifyNowPlaying();

  }
);


/*
==================================================
CREATE ELECTRON WINDOW
==================================================
*/

function createWindow() {

  const win =
    new BrowserWindow({

      width:
        1280,

      height:
        800,

      backgroundColor:
        "#000000",

      autoHideMenuBar:
        true,

      webPreferences: {

        contextIsolation:
          true,

        nodeIntegration:
          false,

        preload:
          path.join(
            __dirname,
            "preload.js"
          )

      }

    });


  /*
  Allow the USB audio input.
  */

  session.defaultSession
    .setPermissionRequestHandler(
      (
        webContents,
        permission,
        callback
      ) => {

        callback(
          permission ===
          "media"
        );

      }
    );


  win.loadFile(

    path.join(
      __dirname,
      "index.html"
    )

  );


  /*
  ==================================================
  OPTIONAL AUTO CAST
  ==================================================
  */

  if (
    AUTO_CAST
  ) {

    win.webContents.once(
      "did-finish-load",
      () => {

        /*
        Give the Electron window time
        to fully appear before capture.
        */

        setTimeout(
          () => {

            startCasting();

          },

          1800
        );

      }
    );

  }

}


/*
==================================================
START APPLICATION
==================================================
*/

app.whenReady()
  .then(
    createWindow
  );


/*
Stop Doubletake when closing the app.
*/

app.on(
  "before-quit",
  () => {

    stopCasting();

  }
);


app.on(
  "window-all-closed",
  () => {

    stopCasting();


    if (
      process.platform !==
      "darwin"
    ) {

      app.quit();

    }

  }
);
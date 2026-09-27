const {
  app,
  BrowserWindow,
  session,
  ipcMain
} = require("electron");

const path = require("path");

const {
  execFile
} = require("child_process");

const {
  promisify
} = require("util");

const execFileAsync =
  promisify(execFile);


/*
==================================================
DISABLE HARDWARE ACCELERATION
==================================================
*/

app.disableHardwareAcceleration();


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
      ].join(separator);


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
        .split(separator);


    const title =
      metadata[0] || "";


    const artist =
      metadata[1] || "";


    const album =
      metadata[2] || "";


    const artUrl =
      metadata[3] || "";


    const durationUs =
      Number(
        metadata[4]
      ) || 0;


    const positionSeconds =
      Number(
        positionResult.stdout.trim()
      ) || 0;


    const status =
      statusResult.stdout.trim();


    return {

      available: true,

      title,

      artist,

      album,

      artUrl,

      durationMs:
        durationUs / 1000,

      positionMs:
        positionSeconds * 1000,

      status,

      isPlaying:
        status === "Playing"

    };


  } catch (error) {

    return {

      available: false

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
CREATE WINDOW
==================================================
*/

function createWindow() {

  const win =
    new BrowserWindow({

      width: 1280,

      height: 800,

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
  Allow USB audio input.
  */

  session.defaultSession
    .setPermissionRequestHandler(
      (
        webContents,
        permission,
        callback
      ) => {

        callback(
          permission === "media"
        );

      }
    );


  win.loadFile(
    path.join(
      __dirname,
      "index.html"
    )
  );

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
==================================================
CLOSE APPLICATION
==================================================
*/

app.on(
  "window-all-closed",
  () => {

    if (
      process.platform !==
      "darwin"
    ) {

      app.quit();

    }

  }
);
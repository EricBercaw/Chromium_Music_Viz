const {
  app,
  BrowserWindow,
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
SETTINGS
==================================================
*/

const AUDIO_DEVICE =
  "alsa_output.pci-0000_00_1b.0.analog-stereo.monitor";

const AUDIO_RATE =
  48000;

const AUDIO_CHANNELS =
  2;


/*
==================================================
DISABLE HARDWARE ACCELERATION
==================================================
*/

app.disableHardwareAcceleration();


/*
==================================================
LIVE AUDIO CAPTURE
==================================================
*/

let audioProcess =
  null;

let audioOwner =
  null;


/*
==================================================
STOP AUDIO
==================================================
*/

function stopAudioCapture() {

  if (audioProcess) {

    try {

      audioProcess.kill(
        "SIGTERM"
      );

    } catch (error) {

      console.error(
        "Could not stop parec:",
        error
      );

    }

  }


  audioProcess =
    null;

  audioOwner =
    null;


  return {
    success: true
  };

}


/*
==================================================
START AUDIO
==================================================
*/

function startAudioCapture(
  webContents
) {

  /*
  Stop an old copy first.
  */

  stopAudioCapture();


  console.log(
    "Starting live audio capture from:"
  );

  console.log(
    AUDIO_DEVICE
  );


  /*
  IMPORTANT:

  This is the same live PipeWire monitor that
  worked in your terminal test.

  Nothing is written to disk.

  parec stdout is raw PCM:
      signed 16-bit little endian
      48 kHz
      stereo
  */

  audioProcess =
    spawn(
      "parec",
      [
        "--device=" +
          AUDIO_DEVICE,

        "--format=s16le",

        "--rate=" +
          AUDIO_RATE,

        "--channels=" +
          AUDIO_CHANNELS
      ],
      {
        stdio: [
          "ignore",
          "pipe",
          "pipe"
        ]
      }
    );


  audioOwner =
    webContents;


  /*
  ==================================================
  PCM DATA
  ==================================================
  */

  audioProcess.stdout.on(
    "data",
    (chunk) => {

      if (
        !audioOwner ||
        audioOwner.isDestroyed()
      ) {

        return;

      }


      /*
      Copy only the actual bytes belonging
      to this Node Buffer.

      Electron IPC then sends this ArrayBuffer
      to the renderer.
      */

      const data =
        chunk.buffer.slice(
          chunk.byteOffset,
          chunk.byteOffset +
            chunk.byteLength
        );


      audioOwner.send(
        "audio-pcm-data",
        data
      );

    }
  );


  /*
  ==================================================
  STDERR
  ==================================================
  */

  audioProcess.stderr.on(
    "data",
    (data) => {

      const message =
        data
          .toString()
          .trim();


      if (message) {

        console.error(
          "parec:",
          message
        );

      }

    }
  );


  /*
  ==================================================
  PROCESS ERROR
  ==================================================
  */

  audioProcess.on(
    "error",
    (error) => {

      console.error(
        "Could not start parec:",
        error
      );


      if (
        audioOwner &&
        !audioOwner.isDestroyed()
      ) {

        audioOwner.send(
          "audio-capture-error",
          error.message
        );

      }


      audioProcess =
        null;

    }
  );


  /*
  ==================================================
  PROCESS EXIT
  ==================================================
  */

  audioProcess.on(
    "close",
    (code, signal) => {

      console.log(
        "parec closed:",
        {
          code,
          signal
        }
      );


      if (
        audioOwner &&
        !audioOwner.isDestroyed()
      ) {

        audioOwner.send(
          "audio-capture-stopped",
          {
            code,
            signal
          }
        );

      }


      audioProcess =
        null;

    }
  );


  return {

    success: true,

    device:
      AUDIO_DEVICE,

    sampleRate:
      AUDIO_RATE,

    channels:
      AUDIO_CHANNELS

  };

}


/*
==================================================
AUDIO IPC
==================================================
*/

ipcMain.handle(
  "audio-start",
  async (
    event
  ) => {

    return startAudioCapture(
      event.sender
    );

  }
);


ipcMain.handle(
  "audio-stop",
  async () => {

    return stopAudioCapture();

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
      metadata[0] ||
      "";


    const artist =
      metadata[1] ||
      "";


    const album =
      metadata[2] ||
      "";


    const artUrl =
      metadata[3] ||
      "";


    /*
    MPRIS length is microseconds.
    */

    const durationUs =
      Number(
        metadata[4]
      ) ||
      0;


    /*
    playerctl position is seconds.
    */

    const positionSeconds =
      Number(
        positionResult.stdout.trim()
      ) ||
      0;


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
CREATE WINDOW
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


  win.loadFile(
    path.join(
      __dirname,
      "index.html"
    )
  );


  /*
  Make sure parec dies if this
  window disappears.
  */

  win.on(
    "closed",
    () => {

      if (
        audioOwner ===
        win.webContents
      ) {

        stopAudioCapture();

      }

    }
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
QUIT
==================================================
*/

app.on(
  "before-quit",
  () => {

    stopAudioCapture();

  }
);


app.on(
  "window-all-closed",
  () => {

    stopAudioCapture();


    if (
      process.platform !==
      "darwin"
    ) {

      app.quit();

    }

  }
);
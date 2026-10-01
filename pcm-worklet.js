/*
==================================================
LIVE PCM AUDIO WORKLET
==================================================

Receives Float32 stereo PCM from index.html.

The samples came from:

PipeWire monitor
      ↓
parec
      ↓
main.js
      ↓
preload.js
      ↓
index.html
      ↓
THIS WORKLET

The worklet outputs the samples into the
Web Audio graph so AnalyserNode can inspect them.

The graph is muted later, so this does NOT
play a second copy of the music.
==================================================
*/


class PCMStreamProcessor
  extends AudioWorkletProcessor {


  constructor() {

    super();


    /*
    Array of stereo Float32 chunks.
    */

    this.queue =
      [];


    /*
    Current chunk position.

    Position is in individual samples,
    not frames.
    */

    this.currentChunk =
      null;

    this.currentOffset =
      0;


    /*
    Prevent infinite latency growth.

    If renderer/main process briefly gets
    behind, old data should be discarded.

    This keeps the visualization LIVE
    rather than slowly drifting seconds
    behind the music.
    */

    this.maxQueuedSamples =
      48000 *
      2 *
      0.50;


    this.queuedSamples =
      0;


    this.port.onmessage =
      (event) => {

        const data =
          event.data;


        if (
          !data ||
          !data.samples
        ) {

          return;

        }


        const samples =
          data.samples;


        this.queue.push(
          samples
        );


        this.queuedSamples +=
          samples.length;


        /*
        If more than ~500 ms gets queued,
        drop oldest chunks.

        For a visualizer, current audio
        matters more than perfect playback.
        */

        while (
          this.queuedSamples >
            this.maxQueuedSamples &&
          this.queue.length >
            1
        ) {

          const dropped =
            this.queue.shift();


          this.queuedSamples -=
            dropped.length;

        }

      };

  }


  /*
  ==================================================
  GET NEXT SAMPLE
  ==================================================
  */

  nextSample() {

    while (
      !this.currentChunk ||
      this.currentOffset >=
        this.currentChunk.length
    ) {

      if (
        this.queue.length ===
        0
      ) {

        this.currentChunk =
          null;

        this.currentOffset =
          0;


        return 0;

      }


      this.currentChunk =
        this.queue.shift();


      this.queuedSamples -=
        this.currentChunk.length;


      this.currentOffset =
        0;

    }


    const value =
      this.currentChunk[
        this.currentOffset
      ];


    this.currentOffset++;


    return value;

  }


  /*
  ==================================================
  AUDIO PROCESS
  ==================================================
  */

  process(
    inputs,
    outputs
  ) {

    const output =
      outputs[0];


    if (
      !output ||
      output.length ===
        0
    ) {

      return true;

    }


    const left =
      output[0];


    const right =
      output[1] ||
      output[0];


    for (
      let i = 0;
      i < left.length;
      i++
    ) {

      /*
      parec sends interleaved:

      L R L R L R...
      */

      const sampleL =
        this.nextSample();

      const sampleR =
        this.nextSample();


      left[i] =
        sampleL;


      right[i] =
        sampleR;

    }


    return true;

  }

}


registerProcessor(
  "pcm-stream-processor",
  PCMStreamProcessor
);

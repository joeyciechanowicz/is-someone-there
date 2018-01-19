const NodeWebcam = require('node-webcam');
const pixelmatch = require('pixelmatch');
const fs = require('fs');
const PNG = require('pngjs').PNG;
const path = require('path');

const height = 600;
const width = 800;
const timeout = 500;
const historySize = 10;
const longHistorySize = 10000;
const longHistorySampleFrequency = 10; // every 10 samples
const threshold = 10.0;

const opts = {
  width: width,
  height: height,
  quality: 100,
  delay: 0,
  saveShots: false,
  output: 'png',
  device: false,
  // device: 'Microsoft® LifeCam HD-3000',
  callbackReturn: "location",
  verbose: false
};

const Webcam = NodeWebcam.create(opts);
//
// Webcam.list((x) => {
//   console.log(x);
// });

let flipper = 1;
let isFirstRun = true;
let history = [];
let longHistory = [];
let currentSum = 0;
let longHistoryCount = 0;

function run() {
  flipper *= -1;
  Webcam.capture(`comp_file${flipper}`, function (err) {
    if (err) {
      console.error(err);
      return;
    }

    if (flipper === -1 && isFirstRun) {
      isFirstRun = false;
      setTimeout(run, timeout);
      return;
    }

    let filesRead = 0;
    const img1 = fs.createReadStream('comp_file-1.png').pipe(new PNG()).on('parsed', doneReading);
    const img2 = fs.createReadStream('comp_file1.png').pipe(new PNG()).on('parsed', doneReading);

    function doneReading() {
      if (++filesRead < 2) return;
      // const diff = new PNG({width: img1.width, height: img1.height});

      const diffPixcelsCount = pixelmatch(img1.data, img2.data, null, img1.width, img1.height, {threshold: 0.1});
      const percentDiff = (diffPixcelsCount / (height * width)) * 100.0;

      // diff.pack().pipe(fs.createWriteStream('diff.png'));
      history.push(percentDiff);
      currentSum += percentDiff;

      if (history.length > historySize) {
        currentSum -= history.shift();

        // make up for JS numbers being floats
        if (currentSum < 1) {
          currentSum = 0;
        }
      }

      if (++longHistoryCount > longHistorySampleFrequency) {
        longHistoryCount = 0;
        const average = currentSum / history.length;
        longHistory.push(average);

        if (longHistory.length > longHistorySize) {
          longHistory.shift();
        }
      }

      setTimeout(run, timeout);
    };

  });
}

run();

const express = require('express');
const app = express();

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname + '/index.html'));
});
app.get('/index.html', function(req, res) {
  res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/data.json', (req, res) => {
  const average = Math.floor(currentSum / history.length);
  const isOccupied = average > threshold;
  const averageTime = history.length * timeout;

  let numAboveThreshold = 0;
  for (let i = 0; i < history.length; i++) {
    if (history[i] > threshold) {
      numAboveThreshold++;
    }
  }
  const certainty = Math.floor((numAboveThreshold / history.length) * 100.0);

  const results = {
    isOccupied,
    certainty,
    threshold,
    sampleInterval: timeout,
    average,
    averageSampleLength: averageTime,
    history
  };

  res.header("Content-Type", 'application/json');
  res.send(JSON.stringify(results, null, 4));
});

app.get('/long-history.json', (req, res) => res.json({
  longHistory: longHistory,
  sampleFrequency: longHistorySampleFrequency
}));

app.get('/clear-history', (req, res) => {
  history = [];
  longHistory = [];
  currentSum = 0;
  longHistoryCount = 0;
  
  res.status(200).send();
})

app.listen(3000, () => console.log('Listening on port http://localhost:3000'));

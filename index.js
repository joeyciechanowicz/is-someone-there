const NodeWebcam = require('node-webcam');
const pixelmatch = require('pixelmatch');
const fs = require('fs');
const PNG = require('pngjs').PNG;

const height = 600;
const width = 800;
const timeout = 5000;

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
      const diff = new PNG({width: img1.width, height: img1.height});

      const diffPixcelsCount = pixelmatch(img1.data, img2.data, diff.data, width, height, {threshold: 0.1});
      const percentDiff = (diffPixcelsCount / (height * width)) * 100.0;

      console.log('Difference = ', percentDiff);

      diff.pack().pipe(fs.createWriteStream('diff.png'));

      // setTimeout(run, timeout);
    };

  });
}

run();

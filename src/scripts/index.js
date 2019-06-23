const remote = require('electron').remote;

const fs = require("fs");

const config = require(__dirname + "/../config.json");
const utils = require(__dirname + "/scripts/utils.js");
const file = require(__dirname + "/scripts/file.js");
const event = require(__dirname + "/scripts/event.js");

event.registerEvents();
event.setScreenCapturedCallback(screenCaptured);

const currentWindow = remote.getCurrentWindow();
const canvas = document.getElementById("main-canvas");
const ctx = canvas.getContext("2d");

const mousePos = {
  x: 0,
  y: 0
};
const mouseDownPos = {
  x: 0,
  y: 0
};
const selectionRect = {
  x1: 0,
  x2: 0,
  y1: 0,
  y2: 0,
  width: 0,
  height: 0
};

let tick = 0,
  currentPixelColor = "#000000";

const screenCaptureImage = new Image();

const STATES = {
  HIDDEN: 0, // app in background
  DISPLAYED: 1, // app displayed, user didn't interact
  START_SELECTION: 2, // user pressed left click
  SELECTING: 3, // user is selecting
  CANCEL_SELECTING: 4, // user used right click to cancel
  CAPTURE: 5, // user released capture button
  CAPTURE_FINISHED: 6, // capture is done
  START_HIDING: 7, // hide app,
  CAPTURING_WINDOWS: 8, // window selection
  CAPTURE_WINDOW: 9 // capture window
};

let currentState = STATES.HIDDEN;
// Should represent all the current windows open
let windowsRectangles = [];

function render() {
  update();

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(screenCaptureImage, 0, 0);

  if (currentState === STATES.DISPLAYED || currentState === STATES.SELECTING || currentState == STATES.CAPTURING_WINDOWS) {
    ctx.font = config.font;
    ctx.fillStyle = config.colors.overlay;

    const magnifierCanvas = document.createElement("canvas");
    const magnifierContext = magnifierCanvas.getContext("2d");

    const pixelSize = config.magnifier.renderSize / config.magnifier.captureSize;

    const magnifierRectSource = {
      x: mousePos.x - config.magnifier.captureSize / 2,
      y: mousePos.y - config.magnifier.captureSize / 2,
      width: config.magnifier.captureSize,
      height: config.magnifier.captureSize
    };

    const magnifierRectTarget = {
      x: mousePos.x + config.magnifier.offset,
      y: mousePos.y + config.magnifier.offset,
      width: config.magnifier.renderSize,
      height: config.magnifier.renderSize
    };

    const mousePositionDisplay = {
      x: magnifierRectTarget.x + magnifierRectTarget.width / 2,
      y: magnifierRectTarget.y + magnifierRectTarget.height + 25
    };

    if (magnifierRectTarget.x + magnifierRectTarget.width > canvas.width) {
      magnifierRectTarget.x -= magnifierRectTarget.width + config.magnifier.offset * 2;
      mousePositionDisplay.x -= (magnifierRectTarget.height + config.magnifier.offset);
    }

    if (magnifierRectTarget.y + magnifierRectTarget.height > canvas.height) {
      magnifierRectTarget.y -= magnifierRectTarget.height + config.magnifier.offset * 2;
      mousePositionDisplay.y -= (magnifierRectTarget.height + config.magnifier.offset) * 2 + 35;
    }

    if (magnifierRectTarget.x < 0) {
      magnifierRectTarget.x += magnifierRectTarget.width + config.magnifier.offset * 2;
      mousePositionDisplay.x += (magnifierRectTarget.height + config.magnifier.offset);
    }

    if (magnifierRectTarget.y < 0) {
      magnifierRectTarget.y += magnifierRectTarget.height + config.magnifier.offset * 2;
      mousePositionDisplay.y += (magnifierRectTarget.height + config.magnifier.offset) * 2 + 35;
    }

    magnifierContext.imageSmoothingEnabled = false;

    magnifierCanvas.width = magnifierRectSource.width;
    magnifierCanvas.height = magnifierRectSource.height;

    let p = ctx.getImageData(mousePos.x, mousePos.y, 1, 1).data;
    currentPixelColor = "#" + ("000000" + utils.rgbToHex(p[0], p[1], p[2])).slice(-6);

    // Draw a small portion of the image on a fake canvas
    magnifierContext.drawImage(canvas, magnifierRectSource.x, magnifierRectSource.y, magnifierRectSource.width, magnifierRectSource.height, 0, 0, magnifierRectSource.width, magnifierRectSource.height);

    if (currentState === STATES.DISPLAYED) {
      //const zoomFactor = config.magnifier.captureSize / config.magnifier.renderSize;
      // Full screen "darker screen"
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (currentState === STATES.SELECTING || currentState == STATES.CAPTURING_WINDOWS) {
      // Horizontal "dark" bars
      ctx.fillRect(0, 0, canvas.width, selectionRect.y1);
      ctx.fillRect(0, selectionRect.y2, canvas.width, canvas.height - selectionRect.y2);

      // Small vertical "dark" bars
      ctx.fillRect(0, selectionRect.y1, selectionRect.x1, selectionRect.height);
      ctx.fillRect(selectionRect.x2, selectionRect.y1, canvas.width - selectionRect.x2, selectionRect.height);

      // "Clear" rectangle border
      ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(selectionRect.x1, selectionRect.y1, selectionRect.width, selectionRect.height);

      ctx.textAlign = "center";
      ctx.fillStyle = "white";

      const approximateTextWidth = 120;
      let infoTextPosition = {
        x: Math.min(canvas.width - approximateTextWidth, Math.max(approximateTextWidth, selectionRect.x1 + selectionRect.width / 2)),
        y: Math.max(selectionRect.y1 - 5, 20)
      };

      ctx.fillText("X: " + selectionRect.x1 + " Y: " + selectionRect.y1 + " W: " + selectionRect.width + " H: " + selectionRect.height,
        infoTextPosition.x,
        infoTextPosition.y);
    }

    // Big cursor
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.strokeRect(mousePos.x, 0, 1, canvas.height);
    ctx.strokeRect(0, mousePos.y, canvas.width, 1);
    ctx.lineWidth = 2;

    // Clip the magnifier in a circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(magnifierRectTarget.x + magnifierRectTarget.width / 2 + pixelSize / 2,
      magnifierRectTarget.y + magnifierRectTarget.height / 2 + pixelSize / 2, magnifierRectTarget.width / 2 - pixelSize / 2, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.stroke();
    ctx.clip();

    // Draw the small canvas on the main canvas to "zoom"
    ctx.drawImage(magnifierCanvas, magnifierRectTarget.x, magnifierRectTarget.y, magnifierRectTarget.width, magnifierRectTarget.height);

    // let color = ((p[0] + p[1] + p[2]) / 3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.fillRect(magnifierRectTarget.x + (magnifierRectTarget.width) / 2, magnifierRectTarget.y, pixelSize, magnifierRectTarget.height);
    ctx.fillRect(magnifierRectTarget.x, magnifierRectTarget.y + (magnifierRectTarget.height) / 2, magnifierRectTarget.width, pixelSize);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";

    for (let x = magnifierRectTarget.x; x < magnifierRectTarget.x + magnifierRectTarget.width; x += (pixelSize)) {
      for (let y = magnifierRectTarget.y; y < magnifierRectTarget.y + magnifierRectTarget.height; y += (pixelSize)) {
        ctx.strokeRect(x, y, pixelSize, pixelSize);
      }
    }

    ctx.restore();

    ctx.fillStyle = "white";
    ctx.textAlign = "center";

    ctx.fillText("X:" + mousePos.x + ", Y:" + mousePos.y, mousePositionDisplay.x, mousePositionDisplay.y);
    ctx.fillText(currentPixelColor, mousePositionDisplay.x, mousePositionDisplay.y + 18);
    ctx.fillStyle = currentPixelColor;
    ctx.fillRect(mousePositionDisplay.x - 4, mousePositionDisplay.y + 24, 16, 16);

  } else if (currentState === STATES.CAPTURE || currentState === STATES.CAPTURE_WINDOW) {
    // Take a "screenshot" of the selected area
    const screenshotCanvas = document.createElement("canvas");
    const screenshotCtx = screenshotCanvas.getContext("2d");
    screenshotCtx.imageSmoothingEnabled = false;

    screenshotCanvas.width = selectionRect.width;
    screenshotCanvas.height = selectionRect.height;
    screenshotCtx.drawImage(canvas, selectionRect.x1, selectionRect.y1, selectionRect.width, selectionRect.height, 0, 0, selectionRect.width, selectionRect.height);
    file.saveAndCopyCanvasImage("./images/" + file.getFileName() + ".png", screenshotCanvas);

    currentWindow.hide();
    // currentState = STATES.CAPTURE_FINISHED;
    currentState = STATES.START_HIDING;
  }

  if (currentState !== STATES.HIDDEN) {
    requestAnimationFrame(render);
  }

  if (config.uploadToImgur && currentState != STATES.SELECTING) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = config.font;
    ctx.textAlign = "left";
    ctx.fillText("Uploading to imgur", 2, 20);
  }
}

function sortSuitableWindows(a, b) {
  return (a.d < b.d || a.s < b.s) ? -1 : 1;
}

function update() {
  tick++;

  switch (currentState) {
    case STATES.START_SELECTION:
      mouseDownPos.x = mousePos.x;
      mouseDownPos.y = mousePos.y;
      currentState = STATES.SELECTING;
      break;
    case STATES.START_HIDING:
      currentWindow.hide();
      currentState = STATES.HIDDEN;
      break;
    case STATES.CANCEL_SELECTING:
      currentState = STATES.DISPLAYED;
      break;
  }

  if (currentState == STATES.CAPTURING_WINDOWS && windowsRectangles.length > 0) {
    let closestWindowCenterDistance = +Infinity;
    let winRectangle = windowsRectangles[0];
    let suitableRectangles = [];
    for (let i = 0; i < windowsRectangles.length; ++i) {
      let rect = windowsRectangles[i];
      let dist = Math.pow(rect.x + rect.w / 2 - mousePos.x, 2) + Math.pow(rect.y + rect.h / 2 - mousePos.y, 2);
      if (mousePos.x > rect.x && mousePos.x < rect.x + rect.w && mousePos.y > rect.y && mousePos.y < rect.y + rect.h) {
        suitableRectangles.push({
          r: rect,
          d: dist,
          s: rect.w * rect.h
        });
        closestWindowCenterDistance = dist;
        winRectangle = rect;
      }
    }

    suitableRectangles = suitableRectangles.sort(sortSuitableWindows);

    if (suitableRectangles[0]) {
      winRectangle = suitableRectangles[0].r;

      selectionRect.x1 = winRectangle.x;
      selectionRect.x2 = winRectangle.x + winRectangle.w;
      selectionRect.y1 = winRectangle.y;
      selectionRect.y2 = winRectangle.y + winRectangle.h;

      selectionRect.width = winRectangle.w;
      selectionRect.height = winRectangle.h;
    }
  } else if (currentState != STATES.CAPTURE_WINDOW) {
    selectionRect.x1 = Math.min(mousePos.x, mouseDownPos.x);
    selectionRect.x2 = Math.max(mousePos.x, mouseDownPos.x);
    selectionRect.y1 = Math.min(mousePos.y, mouseDownPos.y);
    selectionRect.y2 = Math.max(mousePos.y, mouseDownPos.y);

    selectionRect.width = selectionRect.x2 - selectionRect.x1;
    selectionRect.height = selectionRect.y2 - selectionRect.y1;
  }
}

function screenCaptured(imgPath) {
  screenCaptureImage.src = imgPath;
  screenCaptureImage.onload = () => {
    fs.unlink(imgPath, () => {});

    let screenPos = remote.screen.getCursorScreenPoint();
    canvas.width = remote.screen.getDisplayNearestPoint(screenPos).size.width;
    canvas.height = remote.screen.getDisplayNearestPoint(screenPos).size.height;

    currentState = STATES.DISPLAYED;
    render();

    currentWindow.show();
    currentWindow.setFullScreen(false);
    currentWindow.setFullScreen(true);
  };
}
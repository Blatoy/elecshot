const remote = require('electron').remote;

const fs = require("fs");

const config = require(__dirname + "/../config.json");
const utils = require(__dirname + "/scripts/utils.js");
const file = require(__dirname + "/scripts/file.js");
const event = require(__dirname + "/scripts/event.js");

const ntc = require(__dirname + "/scripts/ntc.js");

event.registerEvents();
event.setScreenCapturedCallback(screenCaptured);

const currentWindow = remote.getCurrentWindow();
const canvas = document.getElementById("main-canvas");
const ctx = canvas.getContext("2d");

let drawingColor = "rgb(255, 0, 0)";
let drawnLines = [];
let currentDrawingPoints = {
  points: []
};

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
let currentPixelColor = "#000000";

let drawingPenWidth = 5;
let drawingPenOpacity = 0.7;
let screenCaptureImage = new Image();

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
  CAPTURE_WINDOW: 9, // capture window
  DRAW_LINES: 10,
  DRAWING_LINES: 11,
};

let currentState = STATES.HIDDEN;
// Should represent all the current windows open
let windowsRectangles = [];

const magnifierCanvas = document.createElement("canvas");
const magnifierContext = magnifierCanvas.getContext("2d");

function render() {
  if(screenCaptureImage === null) {
    return;
  }
  
  ctx.drawImage(screenCaptureImage, 0, 0);

  ctx.imageSmoothingEnabled = false;

  // Render drawings
  if (currentState !== STATES.HIDDEN) {

    if (drawnLines.length > 0) {
      ctx.lineCap = "round";
      
      for (let i = 0; i < drawnLines.length; i++) {
        ctx.strokeStyle = drawnLines[i].drawingColor;
        ctx.globalAlpha = drawnLines[i].drawingPenOpacity;
        ctx.lineWidth = drawnLines[i].drawingPenWidth;

        ctx.beginPath();
        ctx.moveTo(drawnLines[i].points[0].x, drawnLines[i].points[0].y);
        for (let j = 1; j < drawnLines[i].points.length; j++) {
          ctx.lineTo(drawnLines[i].points[j].x, drawnLines[i].points[j].y);
        }
        ctx.stroke();
      }
    }

    if (currentDrawingPoints.points.length > 1) {
      ctx.strokeStyle = drawingColor;
      ctx.globalAlpha = drawingPenOpacity;
      ctx.lineWidth = drawingPenWidth;
      ctx.beginPath();
      ctx.moveTo(currentDrawingPoints.points[0].x, currentDrawingPoints.points[0].y);
      for (let i = 0; i < currentDrawingPoints.points.length; i++) {
        ctx.lineTo(currentDrawingPoints.points[i].x, currentDrawingPoints.points[i].y);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    let p = ctx.getImageData(mousePos.x, mousePos.y, 1, 1).data;
    currentPixelColor = "#" + ("000000" + utils.rgbToHex(p[0], p[1], p[2])).slice(-6);
  }


  if (currentState === STATES.DISPLAYED || currentState === STATES.SELECTING || currentState == STATES.CAPTURING_WINDOWS) {
    ctx.font = config.font;
    ctx.fillStyle = config.colors.overlay;

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
      mousePositionDisplay.y -= (magnifierRectTarget.height + config.magnifier.offset) * 2 + 70;
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
    ctx.fillText(currentPixelColor + " - " + ntc.name(currentPixelColor)[1], mousePositionDisplay.x, mousePositionDisplay.y + 18);
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

    currentState = STATES.START_HIDING;
    update();
  }

  if (config.uploadToImgur && currentState != STATES.SELECTING) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = config.font;
    ctx.textAlign = "left";
    ctx.fillText("Uploading to imgur", 2, 20);
  }

  if (currentState === STATES.DRAW_LINES) {
    ctx.fillStyle = drawingColor;
    ctx.globalAlpha = drawingPenOpacity;

    ctx.beginPath();
    ctx.ellipse(mousePos.x, mousePos.y, drawingPenWidth / 2, drawingPenWidth / 2, 0, 2 * Math.PI, 0);
    ctx.fill();

    ctx.globalAlpha = 1;
  }
}

function sortSuitableWindows(a, b) {
  return (a.d < b.d || a.s < b.s) ? -1 : 1;
}

function update() {
  switch (currentState) {
    case STATES.START_SELECTION:
      mouseDownPos.x = mousePos.x;
      mouseDownPos.y = mousePos.y;
      currentState = STATES.SELECTING;
      break;
    case STATES.START_HIDING:
      screenCaptureImage = null;
      canvas.width = 1;
      canvas.height = 1;
      currentWindow.hide();
      currentState = STATES.HIDDEN;
      break;
    case STATES.CANCEL_SELECTING:
      currentState = STATES.DISPLAYED;
      break;
  }

  if (currentState == STATES.CAPTURING_WINDOWS && windowsRectangles.length > 0) {
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

function screenCaptured(imgPath, width, height) {
  screenCaptureImage = new Image();
  screenCaptureImage.src = imgPath;
  screenCaptureImage.onload = () => {
    fs.unlink(imgPath, () => { });

    canvas.width = width;
    canvas.height = height;

    render();
  };
}
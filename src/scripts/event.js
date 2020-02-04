const screenshot = require("screenshot-desktop");
const clipboard = require("electron").clipboard;
const file = require(__dirname + "/file.js");
const windowsManager = require(__dirname + "/window-manager.js");

let screenCapturedCallback = () => {};
let keepDrawing = false;

function onMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  mousePos.x = (e.clientX - rect.left);
  mousePos.y = (e.clientY - rect.top);
  canvas.style.cursor = "crosshair";

  switch (currentState) {
    case STATES.DRAWING_LINES:
      currentDrawingPoints.points.push({
        x: mousePos.x,
        y: mousePos.y,
        color: currentPixelColor
      });
      break;
  }

  update();
  requestAnimationFrame(render);
}

function onMouseWheel(e) {
  if (e.deltaY < 0) {
    config.magnifier.renderSize *= 1.05;
  } else {
    config.magnifier.renderSize /= 1.05;
  }
}

function onMouseDown(e) {
  switch (currentState) {
    case STATES.CAPTURING_WINDOWS:
      if (e.button == 0) {
        currentState = STATES.CAPTURE_WINDOW;
      } else if (e.button == 2) {
        currentState = STATES.CANCEL_SELECTING;
      }
      break;
    case STATES.DISPLAYED:
      if (e.button == 2) {
        currentState = STATES.START_HIDING;
      } else if (e.button == 0) {
        currentState = STATES.START_SELECTION;
      }
      break;
    case STATES.SELECTING:
      if (e.button == 2) {
        currentState = STATES.CANCEL_SELECTING;
      }
      break;
    case STATES.DRAW_LINES:
      currentState = STATES.DRAWING_LINES;
      break;
  }

  update();
  requestAnimationFrame(render);
}

function onMouseUp(e) {
  switch (currentState) {
    case STATES.SELECTING:
      if (e.button == 0) {
        currentState = STATES.CAPTURE;
      }
      break;
    case STATES.DRAWING_LINES:
      currentDrawingPoints.drawingColor = drawingColor;
      currentDrawingPoints.drawingPenOpacity = drawingPenOpacity;
      currentDrawingPoints.drawingPenWidth = drawingPenWidth;

      drawnLines.push(currentDrawingPoints); // TODO: Fix all of this bs global variables
      currentDrawingPoints = {points: []};
      if(!keepDrawing) {
        currentState = STATES.DISPLAYED;
      }
      else {
        currentState = STATES.DRAW_LINES;
      }
      break;
  }

  update();
}

function onKeyDown(e) {
  let mouseSpeed = 1;
  if (e.ctrlKey) {
    mouseSpeed *= config.mouseSpeedModifier;
  }

  canvas.style.cursor = "none";

  switch (e.key) {
    case "Shift":
      switch (currentState) {
        case STATES.DISPLAYED:
          currentState = STATES.START_SELECTION;
          break;
        case STATES.SELECTING:
        case STATES.CAPTURING_WINDOWS:
          currentState = STATES.CANCEL_SELECTING;
          break;
      }
      break;
    case "Enter":
      switch (currentState) {
        case STATES.CAPTURING_WINDOWS:
        case STATES.SELECTING:
          currentState = STATES.CAPTURE_WINDOW;
          break;
        case STATES.DRAW_LINES:
          currentState = STATES.DISPLAYED;
          break;
      }
      break;
    case "Escape":
      switch (currentState) {
        case STATES.DISPLAYED:
          currentState = STATES.START_HIDING;
          break;
        case STATES.SELECTING:
        case STATES.CAPTURING_WINDOWS:
          currentState = STATES.CANCEL_SELECTING;
          break;
        case STATES.DRAW_LINES:
        case STATES.DRAWING_LINES:
          drawnLines = [];
          currentState = STATES.DISPLAYED;
          break;
      }
      break;
    case "ArrowLeft":
      mousePos.x -= mouseSpeed;
      break;
    case "ArrowRight":
      mousePos.x += mouseSpeed;
      break;
    case "ArrowUp":
      mousePos.y -= mouseSpeed;
      break;
    case "ArrowDown":
      mousePos.y += mouseSpeed;
      break;
    case "a":
      if (currentState === STATES.DISPLAYED) {
        windowsManager.getWindowsRectangles().then((windowsRectangles_) => {
          windowsRectangles = windowsRectangles_;
          currentState = STATES.CAPTURING_WINDOWS;
        }).catch(() => {});
      } else if (currentState === STATES.CAPTURING_WINDOWS) {
        capturingWindows = STATES.DISPLAYED;
      }
      break;
    case "d":
      if (currentState === STATES.DISPLAYED) {
        keepDrawing = e.altKey;
        currentState = STATES.DRAW_LINES;
      }
      break;
    case "c":
      if (currentState === STATES.DRAW_LINES) {
        drawingColor = currentPixelColor;
      } else {
        clipboard.writeText(currentPixelColor);
        currentState = STATES.START_HIDING;
      }
      break;
    case "-":
      if (currentState === STATES.DRAW_LINES) {
        if (e.shiftKey) {
          drawingPenOpacity -= 0.1;
          drawingPenOpacity = Math.max(drawingPenOpacity, 0.1);
          drawingPenOpacity = Math.min(drawingPenOpacity, 1);
        } else {
          drawingPenWidth /= 1.2;
        }
      }
      break;
    case "+":
      if (currentState === STATES.DRAW_LINES) {
        if (e.shiftKey) {
          drawingPenOpacity += 0.1;
          drawingPenOpacity = Math.max(drawingPenOpacity, 0.1);
          drawingPenOpacity = Math.min(drawingPenOpacity, 1);
        } else {
          drawingPenWidth *= 1.2;
        }
      }
      break;
    case "i":
      config.uploadToImgur = !config.uploadToImgur;
      break;
  }

  update();
  requestAnimationFrame(render);
}

function onBeforeUnload() {
  globalShortcut.unregisterAll();
}

function onCaptureShortcut() {
  drawnLines = [];

  screenshot.listDisplays().then((displays) => {
    // Find min x/y
    let screenshotDisplay = displays[0];
    let minX = displays[0].offsetX;
    let minY = displays[0].offsetY;
    let maxX = minX + displays[0].width;
    let maxY = minY + displays[0].height;
    for (let i = 1; i < displays.length; i++) {
      if (displays[i].offsetX < minX) {
        minX = displays[i].offsetX;
      }

      if (displays[i].offsetY < minY) {
        minY = displays[i].offsetY;
      }

      if (displays[i].offsetX + displays[i].width > maxX) {
        maxX = displays[i].offsetY + displays[i].width;
      }

      if (displays[i].offsetY + displays[i].height > maxY) {
        maxY = displays[i].offsetY + displays[i].height;
      }
    }


    screenshot({
        filename: file.getFileName() + ".png",
        screen: screenshotDisplay.id,
        linuxLibrary: "scrot"
      })
      .then((imgPath) => {
        currentWindow.show();
        currentState = STATES.DISPLAYED;

        currentWindow.setSize(maxX - minX, maxY - minY);
        currentWindow.setPosition(minX, minY);
        screenCapturedCallback(imgPath, maxX - minX, maxY - minY);
      });
  });
}

module.exports.setScreenCapturedCallback = (func) => {
  screenCapturedCallback = func;
};

module.exports.registerEvents = () => {
  document.onmousemove = onMouseMove;
  document.onmousedown = onMouseDown;
  document.onmouseup = onMouseUp;
  document.onkeydown = onKeyDown;
  document.onmousewheel = onMouseWheel;
  document.onbeforeunload = onBeforeUnload;

  remote.globalShortcut.register(config.shortcuts.defaultCapture, onCaptureShortcut);
};
const screenshot = require("screenshot-desktop");
const file = require(__dirname + "/file.js");

let screenCapturedCallback = () => {};

function onMouseMove(e) {
  // TODO: Handle windows render scaling...
  const rect = canvas.getBoundingClientRect();
  mousePos.x = (e.clientX - rect.left);
  mousePos.y = (e.clientY - rect.top);
  canvas.style.cursor = "crosshair";
}

function onMouseWheel(e) {
  if(e.deltaY < 0) {
    config.magnifier.renderSize *= 1.05;
  }
  else {
    config.magnifier.renderSize /= 1.05;
  }
}

function onMouseDown(e) {
  switch (currentState) {
    case STATES.CAPTURING_WINDOWS:
      if (e.button == 0) {
        currentState = STATES.CAPTURE_WINDOW;
      }
      else if (e.button == 2) {
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
  }
}

function onMouseUp(e) {
  switch (currentState) {
    case STATES.SELECTING:
      if (e.button == 0) {
        currentState = STATES.CAPTURE;
      }
      break;
  }
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
    case "c":
      clipboard.writeText(currentPixelColor);
      currentState = STATES.START_HIDING;
      break;
  }
}

function onKeyUp(e) {
/*  switch (e.key) {
    case "Shift":
      switch (currentState) {
        case STATES.SELECTING:
          currentState = STATES.CAPTURE;
          break;
      }
      break;
    }*/
}

function onBeforeUnload() {
  globalShortcut.unregisterAll();
}

function onCaptureShortcut() {
  screenshot.listDisplays().then((displays) => {
    // TODO: Select correct screen
    screenshot({
        filename: file.getFileName() + ".png",
        screen: displays[displays.length - 1].id
      })
      .then((imgPath) => {
        screenCapturedCallback(imgPath);
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
  document.onkeyup = onKeyUp;
  document.onmousewheel = onMouseWheel;
  document.onbeforeunload = onBeforeUnload;

  globalShortcut.register(config.shortcuts.defaultCapture, onCaptureShortcut);
};


/*
document.onmousedown = (e) => {
  if (!mouseDown) {
    mouseDownPos.x = mousePos.x;
    mouseDownPos.y = mousePos.y;
    mouseDown = true;
  } else {
    mouseDown = false;
  }
};

document.onmouseup = (e) => {
  if (mouseDown) {
    mouseDown = false;
    captureScreen = true;
  }
};

document.onkeydown = (e) => {
  let moveSpeed = 1;
  if (e.ctrlKey) {
    moveSpeed *= 5;
  }

  canvas.style.cursor = "none";

  switch (e.key) {
    case "Escape":
      if (mouseDown) {
        mouseDown = false;
      } else {
        stopRendering = true;
        currentWindow.hide();
      }
      break;
    case "ArrowLeft":
      mousePos.x -= moveSpeed;
      break;
    case "ArrowRight":
      mousePos.x += moveSpeed;
      break;
    case "ArrowUp":
      mousePos.y -= moveSpeed;
      break;
    case "ArrowDown":
      mousePos.y += moveSpeed;
      break;
  }
};*/

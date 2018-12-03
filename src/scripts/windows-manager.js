const { exec } = require('child_process');
const yModifier = -25;

module.exports.getWindowsRectangles = () => {
  return new Promise(function(resolve, reject) {
    // TODO: Handle for windows  / when not installed
    exec('wmctrl -lG', (err, stdout, stderr) => {
      if (err) {
        reject();
        return;
      }

      const lines = stdout.split("\n");
      let windows = [];

      for(let i = 0; i < lines.length; ++i) {
        let line = lines[i].replace(/[ ]{1,}/g, " ");
        let values = line.split(" ");
        if(parseInt(values[3]) + yModifier > 0) {
          windows.push({x: parseInt(values[2]), y: parseInt(values[3]) + yModifier, w: parseInt(values[4]), h: parseInt(values[5])});
        }
      }

      resolve(windows);
    });

  });
};

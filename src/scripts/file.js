module.exports.getFileName = () => {
  // TODO: Allow custom format
  const d = new Date();
  return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDay() + "_" + d.getHours() + "_" + d.getMinutes() + "-" + d.getSeconds();
}

module.exports.saveAndCopyCanvasImage = (path, canvas) => {
  const data = canvas.toDataURL().replace(/^data:image\/\w+;base64,/, "");
  const buf = new Buffer(data, 'base64');

  fs.writeFile(path, buf, () => {
    clipboard.writeImage(path);
  });
};
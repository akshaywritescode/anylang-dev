module.exports = function anylangNextLoader(source) {
  const callback = this.async();
  const options = this.getOptions ? this.getOptions() : {};

  import("./jsx.js")
    .then(({ transformAutoJsx }) => {
      const result = transformAutoJsx(source, this.resourcePath, {
        keyPrefix: options.keyPrefix,
        runtimeImport: options.runtimeImport || "@/anylang"
      });

      callback(null, result.code, null);
    })
    .catch((error) => callback(error));
};

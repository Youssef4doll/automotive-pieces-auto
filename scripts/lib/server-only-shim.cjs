/**
 * Lets a plain Node script import a module that starts with `import
 * "server-only"`.
 *
 * That package is a build-time marker: Next resolves it from its own bundle
 * and swaps in a version that throws if the module is ever pulled into a
 * client component. Outside Next nothing resolves it at all, so importing any
 * server library from a test script fails before the first line of it runs.
 * Next's own copy is pointed at here, which is the same module the app gets.
 */
const Module = require("node:module");
const path = require("node:path");

const real = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") {
    return real.call(this, path.join(__dirname, "../../node_modules/next/dist/compiled/server-only/empty.js"), ...rest);
  }
  return real.call(this, request, ...rest);
};

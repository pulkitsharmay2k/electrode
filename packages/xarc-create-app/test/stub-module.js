"use strict";

/**
 * Replace a module in node's require cache with the given exports, so modules
 * requiring it afterwards get the stub.  Returns a function to restore it.
 */
function stubModule(resolvedPath, exports) {
  const original = require.cache[resolvedPath];

  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    path: require("path").dirname(resolvedPath),
    loaded: true,
    children: [],
    paths: [],
    exports,
  };

  return () => {
    if (original) {
      require.cache[resolvedPath] = original;
    } else {
      delete require.cache[resolvedPath];
    }
  };
}

/**
 * Require a module fresh, bypassing (and not polluting) the require cache.
 */
function freshRequire(resolvedPath) {
  const original = require.cache[resolvedPath];
  delete require.cache[resolvedPath];
  try {
    return require(resolvedPath);
  } finally {
    delete require.cache[resolvedPath];
    if (original) require.cache[resolvedPath] = original;
  }
}

module.exports = { stubModule, freshRequire };

// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// @codeoid/protocol and @codeoid/core ship raw TypeScript source with TS-ESM
// style relative imports ("./types.js" on disk as "types.ts"). Metro does not
// apply the .js -> .ts redirect inside node_modules, so retry failed .js
// resolutions without the extension and let sourceExts (ts, tsx, ...) match.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  try {
    return resolve(context, moduleName, platform);
  } catch (error) {
    if (moduleName.endsWith('.js')) {
      return resolve(context, moduleName.slice(0, -'.js'.length), platform);
    }
    throw error;
  }
};

module.exports = config;

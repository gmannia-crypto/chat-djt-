const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /server[\\/]assets[\\/].*/,
];

module.exports = config;

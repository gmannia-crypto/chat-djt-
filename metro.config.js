const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /server[\\/]assets[\\/].*/,
  /\.local[\\/].*/,
  /node_modules[\\/]\.cache[\\/].*/,
];

module.exports = config;

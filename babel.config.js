module.exports = function(api) {
    api.cache(true);
    return {
      presets: ['@react-native/babel-preset'],
      plugins: [
        ["module:react-native-dotenv", {
          "moduleName": "@env",
          "path": ".env",
          "blacklist": null,
          "whitelist": null,
          "safe": false,
          "allowUndefined": true
        }],
        'react-native-reanimated/plugin',
        ['@babel/plugin-transform-private-methods', { loose: true }],
        ['@babel/plugin-transform-class-properties', { loose: true }],
        ['@babel/plugin-transform-private-property-in-object', { loose: true }],
      ]
    };
  }; 
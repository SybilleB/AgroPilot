// Shim vide pour react-native-worklets sur web.
// Le package n'a pas de support web et fait crasher le bundle.
module.exports = {
  createWorklet: () => {},
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
};

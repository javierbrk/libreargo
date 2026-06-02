// Mock de react-native-safe-area-context para el entorno de tests.
// Los tests no envuelven los componentes en <SafeAreaProvider>, por lo que
// useSafeAreaInsets() lanzaba "No safe area value available". Este mock provee
// insets/frame fijos y deja SafeAreaProvider/SafeAreaView como passthrough.
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: ({ children }) => children(inset),
    SafeAreaView: ({ children, ...props }) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets: inset, frame },
    SafeAreaInsetsContext: React.createContext(inset),
    SafeAreaFrameContext: React.createContext(frame),
  };
});

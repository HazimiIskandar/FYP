import React, { createContext, useContext, useState, useEffect } from 'react';

const FontSizeContext = createContext({
  fontScale: 1,
  setFontScale: () => {},
});

export const FontSizeProvider = ({ children }) => {
  const [fontScale, setFontScaleState] = useState(1);

  useEffect(() => {
    try {
      const stored = globalThis.localStorage?.getItem('fontScale');
      if (stored) {
        setFontScaleState(parseFloat(stored));
      }
    } catch (e) {
      // Ignore
    }
  }, []);

  const setFontScale = (scale) => {
    setFontScaleState(scale);
    try {
      globalThis.localStorage?.setItem('fontScale', scale.toString());
    } catch (e) {
      // Ignore
    }
  };

  return (
    <FontSizeContext.Provider value={{ fontScale, setFontScale }}>
      {children}
    </FontSizeContext.Provider>
  );
};

export const useFontScale = () => useContext(FontSizeContext);

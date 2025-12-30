'use client';

import { useEffect } from 'react';
import tinycolor from 'tinycolor2';

interface ThemeConfig {
  // Light Mode
  bgColor: string;
  fgColor: string;
  accentColor: string;
  
  // Dark Mode
  darkBgColor: string;
  darkFgColor: string;
  darkAccentColor: string;
  
  // State
  darkMode: boolean;
}

export default function ThemeWrapper({ 
  children, 
  config 
}: { 
  children: React.ReactNode; 
  config: ThemeConfig 
}) {
  useEffect(() => {
    const root = document.documentElement;

    // 1. Pick Active Colors based on mode
    const activeBg = config.darkMode ? config.darkBgColor : config.bgColor;
    const activeFg = config.darkMode ? config.darkFgColor : config.fgColor;
    const activeAccent = config.darkMode ? config.darkAccentColor : config.accentColor;

    // 2. Calculate Surface (Header/Footer) Elevation
    let surfaceColor: string;
    let borderColor: string;
    const bgObj = tinycolor(activeBg);

    if (config.darkMode) {
      root.classList.add('dark');
      // Dark Mode: Surface is 8% lighter than background
      surfaceColor = bgObj.clone().lighten(8).toString(); 
      borderColor = bgObj.clone().lighten(20).setAlpha(0.2).toString();
    } else {
      root.classList.remove('dark');
      // Light Mode: Surface is White (unless BG is white, then slightly gray)
      if (bgObj.getBrightness() > 250) {
         surfaceColor = '#f1f5f9'; // Slate-100
      } else {
         surfaceColor = '#ffffff'; 
      }
      borderColor = tinycolor('#000000').setAlpha(0.1).toString();
    }

    // 3. Apply Variables
    root.style.setProperty('--background', activeBg);
    root.style.setProperty('--foreground', activeFg);
    root.style.setProperty('--accent', activeAccent);
    root.style.setProperty('--surface', surfaceColor);
    root.style.setProperty('--border', borderColor);

    // 4. Calculate Accent Text Color (Contrast)
    const accentObj = tinycolor(activeAccent);
    const accentFg = accentObj.isLight() ? '#000000' : '#ffffff';
    root.style.setProperty('--accent-fg', accentFg);

  }, [config]);

  return <>{children}</>;
}
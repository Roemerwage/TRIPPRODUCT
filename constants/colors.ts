const PALETTE = {
  primary: "#0A4A8A",
  accent: "#C9A24D",
  background: "#F6EFE4",
  surface: "#FFFFFF",
  textPrimary: "#0F1A2B",
  textSecondary: "#4A5568",
  border: "#E4D8C5",
  muted: "#9AA3B5",
  success: "#2F855A",
  danger: "#D64545",
};

const DARK = {
  background: "#050E2F",
  surface: "#0A1A3A",
  text: "#F6EFE4",
};

export const Theme = {
  light: {
    ...PALETTE,
    tabIconDefault: "#9AA3B5",
    tabIconSelected: PALETTE.primary,
  },
  dark: {
    ...PALETTE,
    background: DARK.background,
    surface: DARK.surface,
    textPrimary: DARK.text,
    textSecondary: "#C9D1E5",
    tabIconDefault: "#5B6A86",
    tabIconSelected: PALETTE.primary,
    border: PALETTE.accent,
    success: "#3BB982",
    danger: "#F56565",
  },
};

export type ThemeShape = typeof Theme;

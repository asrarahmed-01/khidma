import type { BookingStatus } from "@/api/types";

/**
 * Design tokens. Oasis green carries the brand; saffron is reserved for highlights.
 * Everything else is ink on a cool mineral ground so status colors stay readable.
 */
export const color = {
  oasis: "#0B5D4B",
  oasisPressed: "#084A3C",
  oasisTint: "#E2EFEB",
  oasisOnDark: "#BFE0D6",
  ink: "#13201C",
  inkMuted: "#56645F",
  inkFaint: "#8B9792",
  ground: "#F3F5F4",
  surface: "#FFFFFF",
  line: "#DCE3E0",
  saffron: "#E8A33D",
  saffronTint: "#FCF1DF",
  danger: "#B3261E",
  dangerTint: "#FBEAE8",
  white: "#FFFFFF",
} as const;

export const statusColor: Record<BookingStatus, { fg: string; bg: string }> = {
  PENDING: { fg: "#8A5A12", bg: "#FCF1DF" },
  ACCEPTED: { fg: "#1F55A8", bg: "#E4ECF9" },
  EN_ROUTE: { fg: "#0A6E69", bg: "#DCF1EF" },
  IN_PROGRESS: { fg: "#5E3BA6", bg: "#EEE7F9" },
  COMPLETED: { fg: "#1D6B3A", bg: "#E1F2E6" },
  CANCELLED: { fg: "#5F6865", bg: "#E9EDEB" },
};

/** IBM Plex Sans Arabic covers Arabic and Latin with matching proportions. */
export const font = {
  regular: "IBMPlexSansArabic_400Regular",
  medium: "IBMPlexSansArabic_500Medium",
  semibold: "IBMPlexSansArabic_600SemiBold",
  bold: "IBMPlexSansArabic_700Bold",
} as const;

// Arabic script needs more vertical room than Latin, so line heights run at about 1.5x.
export const type = {
  display: { fontFamily: font.bold, fontSize: 28, lineHeight: 40 },
  title: { fontFamily: font.bold, fontSize: 22, lineHeight: 33 },
  heading: { fontFamily: font.semibold, fontSize: 18, lineHeight: 27 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 25 },
  bodyStrong: { fontFamily: font.medium, fontSize: 16, lineHeight: 25 },
  label: { fontFamily: font.medium, fontSize: 14, lineHeight: 21 },
  caption: { fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
} as const;

export type TypeVariant = keyof typeof type;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

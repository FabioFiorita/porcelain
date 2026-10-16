# Mobile artwork

All build variants share this artwork. Their names, bundle identifiers, schemes,
EAS channels and fingerprint runtime policy remain separate in app.config.ts and
eas.json. Icon and splash changes require a new native binary; an OTA update
cannot replace them.

The source is `scripts/assets/porcelain.icon/Assets/porcelain-logo-1024.png`.
The mobile Icon Composer bundle retains the original bundle's automatic
appearance and material settings. Its opaque, square ceramic layer extends the
original tile to the canvas edges, leaving masking to iOS. Android's legacy icon
uses that same layer.

The built-in imagegen tool preserved the carved branch mark and turquoise accent
while extending the ceramic tile and extracting the transparent glyph. The
1254-square source PNGs pass through Expo's standard native asset generation.
`porcelain-logo-ios.png` is the 1024-square output of Expo's PNG icon prebuild
path, fitted to Icon Composer's 1024-square canvas. The full-size source remains
the Android legacy input. There is no custom resizing pipeline.

`adaptive-foreground.png` pads the glyph inside Android's adaptive safe area;
its alpha also supplies the system-tinted monochrome icon. `splash.png` is the
charcoal glyph for light appearance. `splash-dark.png` is an unchanged copy of
the original ceramic tile, visible against the dark background. Both splashes
use centered contain sizing, and the backgrounds match `packages/theme`'s
white and neutral `oklch(0.145 0 0)` (`#0a0a0a`) backgrounds. Splash visibility
uses Expo's default auto-hide behavior.

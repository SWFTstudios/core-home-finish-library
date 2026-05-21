---
name: Lumina Finish
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c3c6d7'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#8d90a0'
  outline-variant: '#434655'
  surface-tint: '#b4c5ff'
  primary: '#b4c5ff'
  on-primary: '#002a78'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#0053db'
  secondary: '#a4c9ff'
  on-secondary: '#00315d'
  secondary-container: '#0267b8'
  on-secondary-container: '#d6e5ff'
  tertiary: '#89ceff'
  on-tertiary: '#00344d'
  tertiary-container: '#0074a6'
  on-tertiary-container: '#e4f2ff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#d4e3ff'
  secondary-fixed-dim: '#a4c9ff'
  on-secondary-fixed: '#001c39'
  on-secondary-fixed-variant: '#004883'
  tertiary-fixed: '#c9e6ff'
  tertiary-fixed-dim: '#89ceff'
  on-tertiary-fixed: '#001e2f'
  on-tertiary-fixed-variant: '#004c6e'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
  container-max: 1440px
---

## Brand & Style

This design system is built upon the principles of **Technical Minimalism** and **Atmospheric Depth**. Designed for high-performance environments, the aesthetic prioritizes focus and visual hierarchy through the use of deep obsidian surfaces and precise, vibrant accents. 

The target audience consists of professionals and power users who require a low-fatigue interface that remains legible during extended sessions. The emotional response is one of calm authority, precision, and futuristic reliability. To achieve this, the system utilizes a "layered dark" approach—relying on tonal shifts and subtle luminescence rather than traditional heavy shadows to define space and importance.

## Colors

The palette is anchored by the deep navy charcoal (`#0a0a0c`), which serves as the "lowest" foundation. The primary brand blue (`#2563eb`) is used strategically for interactive elements and critical focus points, ensuring high vibrational contrast against the dark background.

*   **Primary Accent:** Used for call-to-actions, active states, and progress indicators.
*   **Surface Hierarchy:** Depth is created by lightening the neutral base as elements move "closer" to the user.
*   **Functional Colors:** Success, Warning, and Error states should use desaturated yet luminous tones (e.g., a soft mint for success) to avoid visual jarring against the dark theme.

## Typography

The typography strategy leverages a mix of technical and functional typefaces. **Geist** provides a sharp, geometric feel for headings, reflecting the system's precision. **Inter** is utilized for body copy to ensure maximum readability and a neutral tone. **JetBrains Mono** is reserved for small labels, data points, and metadata to reinforce the technical nature of the interface.

On dark backgrounds, font weights should be slightly lighter than their light-mode counterparts to prevent "ink bleed" or glowing optical illusions. Use white at 90% opacity for primary text and 60% for secondary text.

## Layout & Spacing

The layout follows a **Rigid 8pt Grid System**. This ensures that all components, from icons to containers, align to a mathematical rhythm that feels intentional and engineered.

*   **Desktop:** A 12-column fluid grid with a maximum container width of 1440px. 
*   **Tablet:** An 8-column fluid grid with 24px gutters.
*   **Mobile:** A 4-column fluid grid with 16px margins.

Vertical rhythm is strictly maintained through multiples of 8px. Use generous whitespace around high-level headers to allow the "Technical Minimalism" style to breathe against the dark canvas.

## Elevation & Depth

In this dark-mode design system, depth is communicated through **Tonal Elevation** and **Inner Luminescence** rather than drop shadows.

1.  **Tonal Layers:** As an element rises in elevation, its background color becomes lighter. `Surface-lowest` is the background; `Surface-low` is for cards; `Surface-high` is for modals and popovers.
2.  **Stroke-based Definition:** Use 1px borders with low-opacity white (e.g., `rgba(255,255,255,0.08)`) to define element boundaries.
3.  **Glow Accents:** High-elevation components (like active buttons or notifications) may use a subtle outer glow using the primary blue at 10-15% opacity to simulate light emitting from the element.

## Shapes

The shape language is **"Soft-Tech."** By utilizing `0.25rem` (4px) as the base radius, the UI maintains a crisp, professional appearance while avoiding the harshness of 0px corners. 

Larger containers such as cards should use `0.5rem` (8px) to provide a clear container-to-content relationship. Interactive elements like buttons and input fields should strictly adhere to the base `0.25rem` radius for a modular, "machined" aesthetic.

## Components

### Buttons
Primary buttons use the brand blue with white text. Hover states should introduce a slight brightness increase and a subtle outer glow. Secondary buttons use a ghost style with a 1px border.

### Input Fields
Fields are dark-filled (slightly lighter than the background) with a 1px border. The border should transition to the primary blue on focus, accompanied by a subtle inner-glow to suggest a "lit" active state.

### Cards
Cards should not have shadows. Instead, they use a slightly lighter surface color than the background and a subtle top-border highlight (0.5px white at 10% opacity) to catch "virtual light" from above.

### Chips & Tags
Use the label font (JetBrains Mono) in all-caps. Chips should be outlined or have a low-opacity color fill (e.g., Blue at 15% opacity) to keep them from competing with primary buttons.

### Lists
Items are separated by thin, low-contrast dividers. Active list items should be indicated by a 2px primary blue vertical bar on the leading edge.
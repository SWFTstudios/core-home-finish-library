---
name: Lumina Finish System
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#434655'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#515659'
  on-tertiary: '#ffffff'
  tertiary-container: '#696e71'
  on-tertiary-container: '#edf1f5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#dfe3e7'
  tertiary-fixed-dim: '#c3c7cb'
  on-tertiary-fixed: '#171c1f'
  on-tertiary-fixed-variant: '#43474b'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-md:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin: 40px
---

## Brand & Style

This design system is engineered for a professional product finish library, prioritizing visual clarity and industrial precision. The brand personality is clinical, organized, and sophisticated, catering to designers and product managers who require an efficient, distraction-free environment for material selection.

The visual style blends **Minimalism** with **Modern Corporate** aesthetics. It utilizes a vast amount of white space to ensure that the subtle textures and colors of the physical product finishes remain the focal point. Soft, diffused depth is used to separate UI layers without creating visual clutter, while a signature blue accent provides a functional path for navigation and selection.

## Colors

The palette is anchored by a high-clarity **Primary Blue**, used strictly for interactive states, selections, and primary actions. 

- **Primary:** A vivid, trustworthy blue used for active selection rings, primary buttons, and progress indicators.
- **Secondary:** A muted slate gray for supporting text and non-critical icons.
- **Tertiary:** A very light gray used for surface backgrounds and container fills to provide soft contrast against the white page background.
- **Neutrals:** Deep slates and blacks are reserved for high-level headings and body text to ensure maximum legibility.

Data-driven indicators (like durability and cost ratings) should use a monochromatic scale of the Neutral color to avoid competing with the Primary Blue.

## Typography

The typography system relies on a pairing of **Hanken Grotesk** for structural headings and **Inter** for functional UI text and body copy.

- **Headlines:** Use Hanken Grotesk with tighter letter spacing for a modern, architectural feel. 
- **Body:** Inter provides exceptional legibility at small sizes, crucial for technical notes and material properties.
- **Labels:** Small caps with increased tracking are used for section numbering (e.g., "(1) MATERIAL") and metadata categories to distinguish them from interactive content.
- **Scaling:** Large display headings should scale down aggressively on mobile to maintain the grid's structural integrity.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy on desktop to maintain the relationship between the central product preview and the flanking selection panels. 

- **Grid Model:** 12-column system with 24px gutters.
- **Main Viewport:** Content is centered with a maximum width of 1440px. 
- **Panel Structure:** Materials and Graphic Applications are housed in structured "Shelf" containers at the top and bottom, while the Finish selector utilizes a vertical or radial "Dial" on the right.
- **Mobile Reflow:** On mobile, the layout transitions to a vertical stack. The right-hand selection dial becomes a bottom-anchored horizontal scroll or drawer to keep the product preview visible at all times.

## Elevation & Depth

This design system uses **Tonal Layers** and **Ambient Shadows** to create a sense of organized hierarchy.

1. **Base Layer:** Pure white (#FFFFFF) for the canvas.
2. **Container Layer:** Tertiary light gray (#F1F5F9) for secondary groupings like the property notes or search bars.
3. **Elevated Elements:** Cards and primary selection panels use a very soft, high-spread shadow: `0 4px 20px rgba(0,0,0,0.05)`.
4. **Active State:** Selected items do not increase in elevation; instead, they receive a 2px interior or exterior border in Primary Blue to maintain a "flat but layered" aesthetic.

Glassmorphism is used sparingly—only for floating action buttons or the selection "dial" background to indicate that they sit above the main workspace.

## Shapes

The shape language is **Rounded**, reflecting the industrial design of the products within the library. 

- **Standard Elements:** Buttons, search bars, and small cards use a 0.5rem (8px) radius.
- **Main Containers:** Large sections (like the Graphic Application shelf) use a 1rem (16px) radius to feel more approachable.
- **Active Indicators:** Pill shapes (full rounding) are reserved for badges and the active selection indicator on the radial dial to provide a clear contrast against the standard rectangular grid.

## Components

### Buttons & Selection
- **Primary Selection:** Large squares with centered icons/previews. On selection, apply a 2px Primary Blue border and a subtle light blue tint to the background.
- **Action Buttons:** Pill-shaped with a solid Primary Blue fill for "Add to Folder" or "Save".

### Input Fields
- **Search Bars:** Subtle gray backgrounds (#F1F5F9) with no border, using a 0.5rem radius. Placeholder text should be Secondary Slate.

### Material Properties (Rating)
- **Dot Scale:** Use a series of 5 dots. Filled dots indicate the rating level using Neutral Slate; empty dots use a light gray tint.

### The Selection Dial
- **Vertical/Radial Scroll:** Items should scale slightly as they approach the center "Active" point. The active item is encased in a Primary Blue ring or highlighted with a pill-shaped backdrop.

### Cards
- **Product Previews:** Use a simple light border or no border with a soft shadow. Backgrounds should be consistently neutral to avoid clashing with the finish colors of the product.
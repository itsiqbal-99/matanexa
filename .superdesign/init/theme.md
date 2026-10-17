# Existing tokens

G0 uses stone background #fafaf9 / #1c1917, Arial UI, emerald accent.
Tailwind v4 PostCSS; no tailwind.config file. No existing logo or licensed font asset.

```css
@import 'tailwindcss';
@custom-variant dark (@media (prefers-color-scheme: dark));
:root { color-scheme: light dark; font-family: Arial, Helvetica, sans-serif; background: #fafaf9; color: #1c1917; }
@media (prefers-color-scheme: dark) { :root { background: #1c1917; color: #fafaf9; } }
```

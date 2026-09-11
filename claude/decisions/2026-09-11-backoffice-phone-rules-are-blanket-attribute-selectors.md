# The back office's phone fixes are a few blanket rules that select inline styles in both spellings

**Ruling.** Below 760px, `Manager.dc.html` and `Organizer.dc.html` each carry a short `@media` block scoped to `.bo`: every flex row wraps and its children get `min-width:0`, every control is 16px, and buttons, padded links and selects are at least 44px tall. Flex rows are found with attribute selectors on the inline style, written twice, `[style*="display:flex"]` and `[style*="display: flex"]`.

**Why.** The dashboards hold dozens of inline flex rows and more than a hundred small font sizes. Naming each one is a larger, riskier diff that rots when a row is added. The renderer re-emits every inline style with a space after the colon, so a selector in the source spelling matches nothing in the browser. It shipped that way once, and only a check against the rendered page caught it.

**Against, and why it lost.** A blanket rule can touch a row that did not need it. A wrong rule fails visibly across the whole page, whereas a missed row fails silently. This makes the pages usable on a phone; it is not a phone design.

**Where in the code.** `Manager.dc.html`, `Organizer.dc.html`, `tools/render-audit.js`.

# Touchstone homepage composer — design QA

## Comparison target

- Source visual truth: `/Users/linshu/.codex/generated_images/019fa7d4-faa9-7983-aab5-4bd8e00fcaea/call_82PZbYMvPAUB1Kp0PfcP7r8l.png`
- Production implementation: `https://touchstone.jefflin.ai/design-qa-composer-20260728-v4`
- Full-view implementation evidence:
  - `/tmp/touchstone-design-qa-20260728/touchstone-composer-production-default.png`
  - `/tmp/touchstone-design-qa-20260728/touchstone-composer-production-settings-final.png`
- Focused settings evidence:
  - Source crop: `/tmp/touchstone-design-qa-20260728/source-settings-focus.png`
  - Implementation capture: `/tmp/touchstone-design-qa-20260728/touchstone-composer-production-settings-focus-final.png`
- Responsive evidence:
  - `/tmp/touchstone-design-qa-20260728/touchstone-composer-mobile.png`
  - `/tmp/touchstone-design-qa-20260728/touchstone-composer-mobile-settings.png`

## Viewport and normalization

- Source pixels: 1487 × 1058.
- Implementation pixels: 1440 × 1024.
- Implementation CSS viewport: 1440 × 1024 at device scale factor 1.
- Both full views have the same 1.405 aspect ratio. They were compared together in one visual input with proportional display scaling; no density-only differences were filed.
- Focused settings captures were compared directly at 421 × 431 source pixels and 420 × 311 implementation CSS pixels. The shorter implementation panel is intentional: the user requested less text and a shorter popup.

## State

- Light theme, public visitor, homepage composer.
- Default composer and settings-open states.
- Connected runner visible in view-only state for a non-owner account.
- Mobile default and settings-open states at 390 × 844 CSS pixels.

## Findings

- No actionable P0, P1, or P2 differences remain.
- The implementation preserves the selected visual's hierarchy: hero, compact prompt surface, bottom action rail, centered floating settings panel, and acid-green primary action.
- Intentional product deviations:
  - Existing Agent/model chips remain in the primary action rail when available because they are required for multi-Agent execution.
  - Provider and Skills controls share one compact row instead of two full-width rows.
  - Explanatory paragraphs and filename metadata are removed from the default composer and settings panel.
  - Runner availability uses the live account-aware state (`可运行` / `仅浏览` / `离线`) instead of static mock copy.

## Required fidelity surfaces

- Fonts and typography: existing Geist Pixel display type, Inter body type, and JetBrains Mono control labels match the product and source hierarchy. Placeholder, section labels, and controls retain readable optical weights without long wrapping.
- Spacing and layout rhythm: composer height is 191 CSS pixels, settings panel is 420 pixels wide, and the panel begins at x=710/y=403 in the 1440 × 1024 view. The panel aligns with the source's central overlay position and does not hide persistent Run controls.
- Colors and visual tokens: existing light-theme neutral surface, dark foregrounds, olive acid accent, semantic amber runner state, borders, radii, and shadows match the selected design and maintain contrast.
- Image quality and asset fidelity: the page uses existing product logo and sponsor assets. UI icons come from the project's Lucide icon library; no placeholder, handcrafted SVG, CSS-art, or generated raster substitute was introduced.
- Copy and content: prompt copy is shortened to `想做点什么？`; default explanatory copy, concurrency text, filename hints, and publish help are removed. Settings use only the short labels needed to understand each control.

## Full-view comparison evidence

- The source and production settings-open screenshot were opened together in one comparison input.
- The final composer proportions, settings x-position, panel width, action placement, typography, colors, and page density match the selected direction.
- The community feed begins directly below the compact composer and remains usable while the settings panel is open.

## Focused-region comparison evidence

- The source settings crop and final production settings element capture were opened together in one comparison input.
- Artifact controls, model/skill actions, publish toggle, runner state, dividers, and advanced disclosure are all readable at native size.
- The implementation intentionally reduces the panel from 431 to 311 pixels high by combining model/skill controls and removing descriptive copy.

## Interaction and runtime checks

- Settings opens and closes from the icon-only trigger.
- HTML, SVG, and Markdown selections update without closing the panel.
- Model Providers opens its existing secure dialog.
- Skills opens its nested selection menu.
- Publish toggle changes state and returns to off.
- Runner status opens its compact detail popover.
- Advanced constraints expand to the editable textarea and collapse again.
- Mobile composer and settings panel fit at 390 × 844 without horizontal overflow.
- No task, provider credential, Skill installation, or publish submission was triggered.
- Production browser console: 0 errors, 0 warnings on the final v4 route.
- Production health: edge online, site online, runner online.

## Comparison history

1. Initial implementation:
   - P2: composer was 247 pixels high versus the source's compact prompt surface.
   - P2: settings panel was right-aligned at x=870 instead of centered near x=710.
   - Fix: reduced textarea rows/min-height and composer minimum height; shifted the panel 160 pixels left and used a negative side offset.
   - Post-fix evidence: `/tmp/touchstone-design-qa-20260728/touchstone-composer-production-settings-final.png`.
2. Focused control pass:
   - P2: runner row repeated `执行器` in both the section label and status trigger.
   - Fix: status trigger now shows only the live state and indicator.
   - Post-fix evidence: `/tmp/touchstone-design-qa-20260728/touchstone-composer-production-settings-focus-final.png`.

## Follow-up polish

- P3: when real Agent chips are numerous, a future pass could add horizontal scrolling instead of wrapping. Current behavior remains functional and readable.

## Final result

final result: passed

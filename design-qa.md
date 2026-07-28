# Touchstone runner and provider UI design QA

## Reference states

- Task composer light-theme screenshot supplied by the user.
- Model Providers light-theme screenshot supplied by the user.
- Target viewport: 1900 × 900 CSS pixels.

## Final states reviewed

- Public visitor with the connected runner unavailable to the current account.
- Advanced delivery constraints expanded.
- Model Providers in read-only mode for a non-owner account.
- ZenMux preset selected with the searchable model multi-select expanded.
- Model selected from the menu, with the selected-count label and removable chip updated.

## Visual checks

- Runner ownership and connection state are visible before the prompt field.
- The page no longer implies that signing in automatically connects the visitor's computer.
- Light-theme semantic colors use darker emerald, sky, violet, amber, and red foregrounds.
- Advanced delivery constraints use a light neutral panel instead of the former dark gray block.
- Provider labels, help text, security copy, search placeholder, and model metadata remain readable.
- The provider dialog preserves the existing Touchstone spacing, typography, borders, and accent palette.
- The model selector fits within the dialog, scrolls independently, and does not crop menu actions.

## Functional checks

- The Provider dialog opens in view-only mode without forcing a login redirect.
- The ZenMux preset loads the models.dev catalog.
- Model search and multi-selection work.
- Selecting `Kimi K3` updates the count to one and renders a removable chip.
- Save, sync, test, and Run remain disabled when the current account cannot use the connected runner.
- No credential or form submission was used during visual QA.

## Result

Passed. No blocking readability, overflow, or interaction issues remain in the reviewed states.

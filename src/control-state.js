// Keep native hover hints and assistive descriptions aligned with live state.
export function setDisabled(control,disabled,reason,enabledTip=''){
  control.disabled=!!disabled;
  const tip=disabled?reason:enabledTip;
  control.dataset.uiTooltip=tip;
  control.title=tip;
  control.setAttribute('aria-description',tip);
}
export const SIMPLIFIED_REASON='Unavailable in simplified rendering. Increase Preferences > System > Simplified Rendering Threshold above the loaded block count, or load a smaller model.';

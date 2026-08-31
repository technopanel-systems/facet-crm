/**
 * `D32`'s bar geometry — the rescale, the tick, and which side the tick reads
 * against. Pure arithmetic, no JSX and no imports.
 *
 * **It exists because there are now two bars drawing one rule.** `D32`'s
 * signature panel is the large one; `D39`'s team table draws a small one per
 * rep, with the same tick. The overage rescale is the fiddly half — *the
 * track's scale is the target until achievement passes it, and then it is the
 * achievement* — and a second copy of it is how the two bars start disagreeing
 * about where the target sits. `CLAUDE.md`: no module invents its own version
 * of a core concept.
 *
 * **Presentation only.** Every number here is a float feeding a CSS length. No
 * displayed figure is derived from any of them — `D32` is explicit that the
 * percentage is display-only and that the pace gap subtracts the two whole
 * metre figures on screen instead. The scaled `bigint` arithmetic stays where
 * it is.
 */

export type PaceGeometry = {
  /** What 100% of the track means — the target, or the achievement once it has
   *  outgrown it. Rendered as `data-scale` so a reader asserting the tick has
   *  the same number the bar used. */
  scale: number;
  /** The solid fill, up to where the target sits. */
  fillPct: number;
  /** The excess past the target, in the same fill at lower opacity. Zero when
   *  the target has not been beaten. */
  overPct: number;
  /** Today's position in the month, divided by the same scale — or the mark
   *  would drift off the day it means the moment a rep went past target. */
  tickPct: number;
  /** Whether the tick lands inside the fill. One colour cannot read against
   *  both a translucent inset and a saturated gradient in both themes, so the
   *  tick takes its colour by side `D32`. */
  tickOnFill: boolean;
};

/**
 * `achievementPct` is never clamped and the fill is never clamped either — it
 * is **rescaled**, so 819 of 800 cannot draw the same full bar as 800 of 800.
 * A negative achievement cannot exist, but the floor is here so a division can
 * never be by zero.
 */
export function paceGeometry(
  achievementPct: number,
  pacePct: number,
): PaceGeometry {
  const reached = Math.max(0, achievementPct);
  // 100 means "the target"; anything beyond it stretches the track instead of
  // being thrown away.
  const scale = Math.max(100, reached);
  return {
    scale,
    fillPct: (Math.min(100, reached) / scale) * 100,
    overPct: (Math.max(0, reached - 100) / scale) * 100,
    tickPct: (pacePct / scale) * 100,
    tickOnFill: Math.min(100, reached) >= pacePct,
  };
}

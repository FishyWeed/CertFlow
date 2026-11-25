export interface RectBox {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	isFrame?: boolean;
}

export interface AlignGuide {
	orientation: 'vertical' | 'horizontal';
	position: number;
	start: number;
	end: number;
	kind: 'canvas' | 'sibling';
}

export interface SpacingGuide {
	orientation: 'vertical' | 'horizontal';
	/** Line start & end in canvas coordinates */
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	gapPx: number;
}

export interface SnapResult {
	x: number;
	y: number;
	alignGuides: AlignGuide[];
	spacingGuides: SpacingGuide[];
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
	return Math.min(aEnd, bEnd) - Math.max(aStart, bStart) > 4;
}

function overlapMidpoint(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
	const lo = Math.max(aStart, bStart);
	const hi = Math.min(aEnd, bEnd);
	if (hi > lo) return (lo + hi) / 2;
	return (aStart + aEnd + bStart + bEnd) / 4;
}

/**
 * Pure smart-snapping engine for the Konva certificate editor.
 * Supports:
 * 1. Canvas centre alignment (X and Y).
 * 2. Sibling edge and centre alignment (Left/Centre/Right, Top/Middle/Bottom).
 * 3. Equal-spacing snapping between two elements (midpoint) or across an existing neighbour gap rhythm.
 */
export function computeSnapResult(
	active: RectBox,
	allSiblings: RectBox[],
	stageW: number,
	stageH: number,
	threshold = 6
): SnapResult {
	// Ignore large enclosing border frames so spacing snaps to real content elements.
	const siblings = allSiblings.filter(
		(s) => s.id !== active.id && !s.isFrame && !(s.width > stageW * 0.7 && s.height > stageH * 0.7)
	);

	let bestDx: number | null = null;
	let bestXDist = threshold + 1;
	let xGuides: AlignGuide[] = [];
	let xSpacing: SpacingGuide[] = [];

	let bestDy: number | null = null;
	let bestYDist = threshold + 1;
	let yGuides: AlignGuide[] = [];
	let ySpacing: SpacingGuide[] = [];

	const activeCx = active.x + active.width / 2;
	const activeCy = active.y + active.height / 2;
	const activeRight = active.x + active.width;
	const activeBottom = active.y + active.height;

	// -------------------------------------------------------------------------
	// 1. Canvas Centre Alignment
	// -------------------------------------------------------------------------
	const stageCx = stageW / 2;
	const stageCy = stageH / 2;

	const dStageX = stageCx - activeCx;
	if (Math.abs(dStageX) <= threshold && Math.abs(dStageX) < bestXDist) {
		bestXDist = Math.abs(dStageX);
		bestDx = dStageX;
		xGuides = [
			{ orientation: 'vertical', position: stageCx, start: 0, end: stageH, kind: 'canvas' }
		];
	}

	const dStageY = stageCy - activeCy;
	if (Math.abs(dStageY) <= threshold && Math.abs(dStageY) < bestYDist) {
		bestYDist = Math.abs(dStageY);
		bestDy = dStageY;
		yGuides = [
			{ orientation: 'horizontal', position: stageCy, start: 0, end: stageW, kind: 'canvas' }
		];
	}

	// -------------------------------------------------------------------------
	// 2. Sibling Edge and Centre Alignment
	// -------------------------------------------------------------------------
	for (const sib of siblings) {
		const sibCx = sib.x + sib.width / 2;
		const sibRight = sib.x + sib.width;
		const sibCy = sib.y + sib.height / 2;
		const sibBottom = sib.y + sib.height;

		const xCandidates: Array<{ activeVal: number; targetVal: number }> = [
			{ activeVal: activeCx, targetVal: sibCx },
			{ activeVal: active.x, targetVal: sib.x },
			{ activeVal: activeRight, targetVal: sibRight },
			{ activeVal: active.x, targetVal: sibRight },
			{ activeVal: activeRight, targetVal: sib.x }
		];

		for (const c of xCandidates) {
			const dx = c.targetVal - c.activeVal;
			const dist = Math.abs(dx);
			if (dist <= threshold && dist < bestXDist) {
				bestXDist = dist;
				bestDx = dx;
				xGuides = [
					{
						orientation: 'vertical',
						position: c.targetVal,
						start: Math.min(active.y, sib.y) - 16,
						end: Math.max(activeBottom, sibBottom) + 16,
						kind: 'sibling'
					}
				];
				xSpacing = [];
			}
		}

		const yCandidates: Array<{ activeVal: number; targetVal: number }> = [
			{ activeVal: activeCy, targetVal: sibCy },
			{ activeVal: active.y, targetVal: sib.y },
			{ activeVal: activeBottom, targetVal: sibBottom },
			{ activeVal: active.y, targetVal: sibBottom },
			{ activeVal: activeBottom, targetVal: sib.y }
		];

		for (const c of yCandidates) {
			const dy = c.targetVal - c.activeVal;
			const dist = Math.abs(dy);
			if (dist <= threshold && dist < bestYDist) {
				bestYDist = dist;
				bestDy = dy;
				yGuides = [
					{
						orientation: 'horizontal',
						position: c.targetVal,
						start: Math.min(active.x, sib.x) - 16,
						end: Math.max(activeRight, sibRight) + 16,
						kind: 'sibling'
					}
				];
				ySpacing = [];
			}
		}
	}

	// -------------------------------------------------------------------------
	// 3. Vertical Equal-Spacing Snapping (between two elements or matching a neighbour gap)
	// -------------------------------------------------------------------------
	const hOverlapping = siblings
		.filter((s) => rangesOverlap(active.x, activeRight, s.x, s.x + s.width))
		.sort((a, b) => a.y - b.y);

	// 3a. Dragging BETWEEN an element directly above and an element directly below
	const aboveList = hOverlapping.filter((s) => s.y + s.height <= active.y + threshold);
	const belowList = hOverlapping.filter((s) => s.y >= activeBottom - threshold);
	const nearestAbove = aboveList.at(-1);
	const nearestBelow = belowList[0];

	if (nearestAbove && nearestBelow) {
		const aboveBottom = nearestAbove.y + nearestAbove.height;
		const belowTop = nearestBelow.y;
		const totalFree = belowTop - aboveBottom - active.height;

		if (totalFree >= 4) {
			const equalGap = totalFree / 2;
			const targetY = aboveBottom + equalGap;
			const dy = targetY - active.y;
			const dist = Math.abs(dy);

			// Equal spacing between neighbours wins ties over generic alignment.
			if (dist <= threshold && dist <= bestYDist) {
				bestYDist = dist;
				bestDy = dy;
				const snappedX = active.x + (bestDx ?? 0);
				const guideX = overlapMidpoint(
					snappedX,
					snappedX + active.width,
					Math.min(nearestAbove.x, nearestBelow.x),
					Math.max(nearestAbove.x + nearestAbove.width, nearestBelow.x + nearestBelow.width)
				);
				const gapRounded = Math.round(equalGap);
				yGuides = [];
				ySpacing = [
					{
						orientation: 'vertical',
						x1: guideX,
						y1: aboveBottom,
						x2: guideX,
						y2: targetY,
						gapPx: gapRounded
					},
					{
						orientation: 'vertical',
						x1: guideX,
						y1: targetY + active.height,
						x2: guideX,
						y2: belowTop,
						gapPx: gapRounded
					}
				];
			}
		}
	}

	// 3b. Continuing an existing vertical gap rhythm (A -> B already spaced by g; dragging C below B or above A)
	if (ySpacing.length === 0 && hOverlapping.length >= 2) {
		for (let i = 0; i < hOverlapping.length - 1; i++) {
			const topSib = hOverlapping[i];
			const botSib = hOverlapping[i + 1];
			const gap = botSib.y - (topSib.y + topSib.height);
			if (gap < 4) continue;

			const snappedX = active.x + (bestDx ?? 0);
			const guideX = overlapMidpoint(
				snappedX,
				snappedX + active.width,
				Math.min(topSib.x, botSib.x),
				Math.max(topSib.x + topSib.width, botSib.x + botSib.width)
			);

			// Candidate below botSib
			const targetBelowY = botSib.y + botSib.height + gap;
			const dyBelow = targetBelowY - active.y;
			if (Math.abs(dyBelow) <= threshold && Math.abs(dyBelow) <= bestYDist) {
				bestYDist = Math.abs(dyBelow);
				bestDy = dyBelow;
				yGuides = [];
				ySpacing = [
					{
						orientation: 'vertical',
						x1: guideX,
						y1: topSib.y + topSib.height,
						x2: guideX,
						y2: botSib.y,
						gapPx: Math.round(gap)
					},
					{
						orientation: 'vertical',
						x1: guideX,
						y1: botSib.y + botSib.height,
						x2: guideX,
						y2: targetBelowY,
						gapPx: Math.round(gap)
					}
				];
			}

			// Candidate above topSib
			const targetAboveY = topSib.y - gap - active.height;
			const dyAbove = targetAboveY - active.y;
			if (Math.abs(dyAbove) <= threshold && Math.abs(dyAbove) <= bestYDist) {
				bestYDist = Math.abs(dyAbove);
				bestDy = dyAbove;
				yGuides = [];
				ySpacing = [
					{
						orientation: 'vertical',
						x1: guideX,
						y1: targetAboveY + active.height,
						x2: guideX,
						y2: topSib.y,
						gapPx: Math.round(gap)
					},
					{
						orientation: 'vertical',
						x1: guideX,
						y1: topSib.y + topSib.height,
						x2: guideX,
						y2: botSib.y,
						gapPx: Math.round(gap)
					}
				];
			}
		}
	}

	// -------------------------------------------------------------------------
	// 4. Horizontal Equal-Spacing Snapping (Between two side-by-side elements OR matching gap)
	// -------------------------------------------------------------------------
	const vOverlapping = siblings
		.filter((s) => rangesOverlap(active.y, activeBottom, s.y, s.y + s.height))
		.sort((a, b) => a.x - b.x);

	const leftList = vOverlapping.filter((s) => s.x + s.width <= active.x + threshold);
	const rightList = vOverlapping.filter((s) => s.x >= activeRight - threshold);
	const nearestLeft = leftList.at(-1);
	const nearestRight = rightList[0];

	if (nearestLeft && nearestRight) {
		const leftRight = nearestLeft.x + nearestLeft.width;
		const rightLeft = nearestRight.x;
		const totalFree = rightLeft - leftRight - active.width;

		if (totalFree >= 4) {
			const equalGap = totalFree / 2;
			const targetX = leftRight + equalGap;
			const dx = targetX - active.x;
			const dist = Math.abs(dx);

			if (dist <= threshold && dist <= bestXDist) {
				bestXDist = dist;
				bestDx = dx;
				const snappedY = active.y + (bestDy ?? 0);
				const guideY = overlapMidpoint(
					snappedY,
					snappedY + active.height,
					Math.min(nearestLeft.y, nearestRight.y),
					Math.max(nearestLeft.y + nearestLeft.height, nearestRight.y + nearestRight.height)
				);
				const gapRounded = Math.round(equalGap);
				xGuides = [];
				xSpacing = [
					{
						orientation: 'horizontal',
						x1: leftRight,
						y1: guideY,
						x2: targetX,
						y2: guideY,
						gapPx: gapRounded
					},
					{
						orientation: 'horizontal',
						x1: targetX + active.width,
						y1: guideY,
						x2: rightLeft,
						y2: guideY,
						gapPx: gapRounded
					}
				];
			}
		}
	}

	if (xSpacing.length === 0 && vOverlapping.length >= 2) {
		for (let i = 0; i < vOverlapping.length - 1; i++) {
			const leftSib = vOverlapping[i];
			const rightSib = vOverlapping[i + 1];
			const gap = rightSib.x - (leftSib.x + leftSib.width);
			if (gap < 4) continue;

			const snappedY = active.y + (bestDy ?? 0);
			const guideY = overlapMidpoint(
				snappedY,
				snappedY + active.height,
				Math.min(leftSib.y, rightSib.y),
				Math.max(leftSib.y + leftSib.height, rightSib.y + rightSib.height)
			);

			const targetRightX = rightSib.x + rightSib.width + gap;
			const dxRight = targetRightX - active.x;
			if (Math.abs(dxRight) <= threshold && Math.abs(dxRight) <= bestXDist) {
				bestXDist = Math.abs(dxRight);
				bestDx = dxRight;
				xGuides = [];
				xSpacing = [
					{
						orientation: 'horizontal',
						x1: leftSib.x + leftSib.width,
						y1: guideY,
						x2: rightSib.x,
						y2: guideY,
						gapPx: Math.round(gap)
					},
					{
						orientation: 'horizontal',
						x1: rightSib.x + rightSib.width,
						y1: guideY,
						x2: targetRightX,
						y2: guideY,
						gapPx: Math.round(gap)
					}
				];
			}

			const targetLeftX = leftSib.x - gap - active.width;
			const dxLeft = targetLeftX - active.x;
			if (Math.abs(dxLeft) <= threshold && Math.abs(dxLeft) <= bestXDist) {
				bestXDist = Math.abs(dxLeft);
				bestDx = dxLeft;
				xGuides = [];
				xSpacing = [
					{
						orientation: 'horizontal',
						x1: targetLeftX + active.width,
						y1: guideY,
						x2: leftSib.x,
						y2: guideY,
						gapPx: Math.round(gap)
					},
					{
						orientation: 'horizontal',
						x1: leftSib.x + leftSib.width,
						y1: guideY,
						x2: rightSib.x,
						y2: guideY,
						gapPx: Math.round(gap)
					}
				];
			}
		}
	}

	return {
		x: active.x + (bestDx ?? 0),
		y: active.y + (bestDy ?? 0),
		alignGuides: [...xGuides, ...yGuides],
		spacingGuides: [...xSpacing, ...ySpacing]
	};
}

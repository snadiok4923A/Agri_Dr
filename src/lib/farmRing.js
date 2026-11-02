export const FARM_RING_RADIUS = 48;
export const FARM_RING_CIRCUMFERENCE = 2 * Math.PI * FARM_RING_RADIUS;

export function getFarmRingSegmentLengths(values) {
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!(total > 0)) return [];

    let consumed = 0;
    return values.map((value, index) => {
        const length = index === values.length - 1
            ? FARM_RING_CIRCUMFERENCE - consumed
            : (value / total) * FARM_RING_CIRCUMFERENCE;
        consumed += length;
        return length;
    });
}

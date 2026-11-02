import assert from "node:assert/strict";
import { test } from "node:test";
import {
    FARM_RING_CIRCUMFERENCE,
    getFarmRingSegmentLengths,
} from "./farmRing.js";

test("farm ring segment lengths fill the complete circumference", () => {
    for (const areas of [[4, 1, 5], [3, 2, 5], [7], [1, 2, 3, 4]]) {
        const lengths = getFarmRingSegmentLengths(areas);
        const sum = lengths.reduce((total, length) => total + length, 0);
        assert.ok(Math.abs(sum - FARM_RING_CIRCUMFERENCE) < 1e-10);
    }
});

test("farm ring has no segments for invalid totals", () => {
    assert.deepEqual(getFarmRingSegmentLengths([0, -1]), []);
});

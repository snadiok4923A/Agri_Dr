import test from "node:test";
import assert from "node:assert/strict";
import { parseVoiceCommand, normalizeTranscript } from "./voiceCommandParser.js";

const intentOf = (text) => parseVoiceCommand(text)?.intent ?? null;

test("Bengali loanwords normalise to the same canonical tokens as English", () => {
    assert.equal(
        normalizeTranscript("ওয়েদার দেখতে চাই"),
        normalizeTranscript("weather dekhao"),
    );
    assert.equal(
        normalizeTranscript("মার্কেট দেখতে চাই"),
        normalizeTranscript("market dekhao"),
    );
});

test("the reported live transcript resolves to OPEN_WEATHER", () => {
    assert.equal(intentOf("ওয়েদার দেখতে চাই"), "OPEN_WEATHER");
    assert.equal(intentOf("আবহাওয়া দেখতে চাই"), "OPEN_WEATHER");
});

test("English weather phrasing is unchanged", () => {
    assert.equal(intentOf("show weather"), "OPEN_WEATHER");
    assert.equal(intentOf("weather dekhao"), "OPEN_WEATHER");
    assert.equal(intentOf("weather"), "OPEN_WEATHER");
});

test("Bengali market phrasing resolves to OPEN_MARKET", () => {
    assert.equal(intentOf("মার্কেট দেখতে চাই"), "OPEN_MARKET");
    assert.equal(intentOf("বাজার দেখাও"), "OPEN_MARKET");
    assert.equal(intentOf("মার্কেট খুলতে চাই"), "OPEN_MARKET");
});

test("other primary intents accept Bengali verb forms", () => {
    const cases = [
        ["আমার জমি দেখতে চাই", "OPEN_MY_FARM"],
        ["খামার দেখতে চাই", "OPEN_MY_FARM"],
        ["রোগ দেখতে চাই", "OPEN_DISEASE_MEDICINE"],
        ["সার দেখতে চাই", "OPEN_FERTILIZER_PLAN"],
        ["খরচ দেখতে চাই", "OPEN_COST_PROFIT"],
        ["লাভ দেখতে চাই", "OPEN_COST_PROFIT"],
        ["ডাক্তার দেখতে চাই", "OPEN_AI_DOCTOR"],
        ["সেটিংস খুলতে চাই", "OPEN_SETTINGS"],
        ["ভয়েস বন্ধ করতে চাই", "STOP_VOICE_MODE"],
    ];
    for (const [text, expected] of cases) {
        assert.equal(intentOf(text), expected, text);
    }
});

test("existing English commands still parse", () => {
    assert.equal(intentOf("open market"), "OPEN_MARKET");
    assert.equal(intentOf("open my farm"), "OPEN_MY_FARM");
    assert.equal(intentOf("stop voice"), "STOP_VOICE_MODE");
    assert.equal(intentOf("open settings"), "OPEN_SETTINGS");
});

test("non-command sentences still return null", () => {
    assert.equal(intentOf("purple elephant dances slowly"), null);
    assert.equal(intentOf("আজ আকাশ খুব নীল"), null);
});

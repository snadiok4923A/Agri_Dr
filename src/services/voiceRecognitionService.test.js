import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createVoiceRecognitionService } from "./voiceRecognitionService.js";

const originalWindow = globalThis.window;

afterEach(() => {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
});

test("starts recognition synchronously so a click retains browser user activation", () => {
    let startCalls = 0;

    class FakeRecognition {
        start() {
            startCalls += 1;
        }

        abort() {}
        stop() {}
    }

    globalThis.window = { SpeechRecognition: FakeRecognition };
    const service = createVoiceRecognitionService();

    service.start();

    assert.equal(startCalls, 1, "recognition should start before start() returns");
    assert.equal(service.getState(), "starting");
    service.stop();
});

test("reports and remembers a browser microphone denial", () => {
    let recognition;
    const errors = [];

    class FakeRecognition {
        constructor() {
            recognition = this;
        }

        start() {}
        abort() {}
        stop() {}
    }

    globalThis.window = { SpeechRecognition: FakeRecognition };
    const service = createVoiceRecognitionService({ onError: (code) => errors.push(code) });

    service.start();
    recognition.onerror({ error: "not-allowed" });
    service.start();

    assert.deepEqual(errors, ["not-allowed", "not-allowed"]);
    assert.equal(service.getState(), "error");
    service.stop();
});

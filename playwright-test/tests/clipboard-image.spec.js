import { test as base, expect } from "@playwright/test";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(
    /\/+$/,
    "",
);
const APP_URL = BASE + "/Agri_Dr/";
const STATUS_PATH = "/Agri_Dr/api/disease/v2/status";
const PASTE_LABEL = "Paste image from clipboard";
const PASTE_SHORTCUT = process.platform === "darwin" ? "Meta+V" : "Control+V";
const READY_STATUS = {
    available: true,
    classes: 15,
    model_version: "rice-disease-warmstart-v1",
    production: false,
};
const MESSAGES = {
    empty: "No image found in the clipboard. Copy an image first, then try Paste.",
    denied: "Clipboard access was blocked. Allow clipboard access or use Upload Photo.",
    unavailable:
        "Clipboard access is unavailable here. Use Upload Photo, or try Ctrl+V / Cmd+V in the preview.",
    invalid:
        "The clipboard image could not be opened. Copy a different image and try again.",
    unsupported: "Please paste a JPEG, PNG, or WEBP image.",
    large: "The image must be smaller than 10 MB.",
};

// HTTP responses are mocked throughout, including the native-clipboard/camera tests.
// Ordinary clipboard tests stub read(), but return real browser ClipboardItems/Blobs.
const test = base.extend({
    predictionRequests: [
        async ({ page }, use) => {
            const requests = [];
            await page.route(
                /\/disease\/(?:v2\/)?predict\/?(?:\?.*)?$/,
                (route) => {
                    const request = route.request();
                    const headers = {
                        "access-control-allow-origin": "*",
                        "access-control-allow-methods": "POST, OPTIONS",
                        "access-control-allow-headers": "*",
                    };
                    if (request.method() === "OPTIONS") {
                        return route.fulfill({ status: 204, headers });
                    }
                    requests.push(request);
                    const v2 = new URL(request.url()).pathname.endsWith(
                        "/disease/v2/predict",
                    );
                    return route.fulfill({
                        headers,
                        json: {
                            status: "uncertain",
                            confidence: 0.4,
                            top_predictions: [],
                            ...(v2
                                ? { model_version: READY_STATUS.model_version }
                                : {}),
                        },
                    });
                },
            );
            await use(requests);
        },
        { auto: true },
    ],
});

// launchOptions is worker-scoped, so fake-device flags must be file-scoped.
test.use({
    launchOptions: {
        args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
        ],
    },
});

const dashboardPaste = (page) => page.locator(".dashboard-diagnosis-paste");
const modalPaste = (page) => page.locator(".camodal__paste");
const picker = (page) => page.getByRole("combobox", { name: "Analysis model" });
const dialog = (page) => page.locator(".camodal__overlay");
const photo = (page) => page.locator(".camodal__photo");

// Observational wrappers delegate to the real URL APIs; decoder scratch URLs are
// deliberately not counted as previews. Assertions use actual <img src> values.
test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem("krisiveda.guest", "1");
        localStorage.setItem("krisiveda-lang", "en");
        const create = URL.createObjectURL.bind(URL);
        const revoke = URL.revokeObjectURL.bind(URL);
        window.__clipboardURLs = { created: [], revoked: [] };
        URL.createObjectURL = (blob) => {
            const url = create(blob);
            window.__clipboardURLs.created.push(url);
            return url;
        };
        URL.revokeObjectURL = (url) => {
            window.__clipboardURLs.revoked.push(String(url));
            return revoke(url);
        };
    });
    await page.route("**" + STATUS_PATH, (route) =>
        route.fulfill({ json: READY_STATUS }),
    );
    await page.goto(APP_URL);
    await expect(dashboardPaste(page)).toBeVisible();
});

async function canvasImage(
    page,
    { mimeType = "image/png", width = 160, height = 96 } = {},
) {
    const result = await page.evaluate(
        async ({ mimeType, width, height }) => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#e7edc7";
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = "#24833a";
            ctx.beginPath();
            ctx.ellipse(
                width / 2,
                height / 2,
                width / 3,
                height / 4,
                -0.3,
                0,
                Math.PI * 2,
            );
            ctx.fill();
            ctx.strokeStyle = "#123f22";
            ctx.beginPath();
            ctx.moveTo(width / 4, height * 0.65);
            ctx.lineTo(width * 0.75, height * 0.35);
            ctx.stroke();
            const blob = await new Promise((resolve) =>
                canvas.toBlob(resolve, mimeType),
            );
            if (!blob) throw new Error("Canvas did not produce an image");
            return {
                mimeType: blob.type,
                bytes: [...new Uint8Array(await blob.arrayBuffer())],
            };
        },
        { mimeType, width, height },
    );
    expect(result.mimeType).toBe(mimeType);
    const extension =
        mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
    return {
        name: `leaf-${width}x${height}.${extension}`,
        mimeType,
        width,
        height,
        buffer: Buffer.from(result.bytes),
    };
}

const filePayload = ({ name, mimeType, buffer }) => ({
    name,
    mimeType,
    buffer,
});
const clipboardItem = ({ mimeType, buffer }) => ({
    mimeType,
    bytes: [...buffer],
});

async function mockRead(
    page,
    { items = [], errorName = null, deferred = false, unavailable = null } = {},
) {
    await page.evaluate(
        ({ items, errorName, deferred, unavailable }) => {
            const state = { calls: 0, pending: [] };
            window.__clipboardRead = state;
            const read = () => {
                state.calls += 1;
                return new Promise((resolve, reject) => {
                    const finish = () => {
                        if (errorName)
                            return reject(
                                new DOMException(
                                    "Clipboard test denial",
                                    errorName,
                                ),
                            );
                        resolve(
                            items.map((item) => {
                                const bytes =
                                    item.text ??
                                    new Uint8Array(item.bytes || []);
                                const parts = [bytes];
                                if (item.size)
                                    parts.push(
                                        new Uint8Array(
                                            Math.max(
                                                0,
                                                item.size - bytes.length,
                                            ),
                                        ),
                                    );
                                return new ClipboardItem({
                                    [item.mimeType]: new Blob(parts, {
                                        type: item.mimeType,
                                    }),
                                });
                            }),
                        );
                    };
                    if (deferred) state.pending.push(finish);
                    else finish();
                });
            };
            Object.defineProperty(navigator, "clipboard", {
                configurable: true,
                value:
                    unavailable === "clipboard"
                        ? undefined
                        : unavailable === "read"
                          ? {}
                          : { read },
            });
        },
        { items, errorName, deferred, unavailable },
    );
}

const readCalls = (page) => page.evaluate(() => window.__clipboardRead.calls);
const releaseRead = (page) =>
    page.evaluate(() =>
        window.__clipboardRead.pending.splice(0).forEach((finish) => finish()),
    );
const revoked = (page, url) =>
    page.evaluate(
        (url) =>
            window.__clipboardURLs.revoked.filter((value) => value === url)
                .length,
        url,
    );

async function uploadPreview(page, image) {
    await page
        .locator('input[type="file"][accept="image/*"]')
        .setInputFiles(filePayload(image));
    return expectPreview(page, image);
}

async function chooseFile(page, button, image) {
    const chooserPromise = page.waitForEvent("filechooser");
    await button.click();
    await (await chooserPromise).setFiles(filePayload(image));
}

async function selectV2(page) {
    await expect(picker(page).locator('option[value="v2"]')).toHaveJSProperty(
        "disabled",
        false,
    );
    await picker(page).selectOption("v2");
}

async function expectPreview(
    page,
    image,
    { retake = false, exactBytes = true } = {},
) {
    await expect(dialog(page)).toBeVisible();
    await expect(photo(page)).toBeVisible();
    await expect
        .poll(() =>
            photo(page).evaluate((img) => img.complete && img.naturalWidth > 0),
        )
        .toBe(true);
    await expect(photo(page)).toHaveJSProperty("naturalWidth", image.width);
    await expect(photo(page)).toHaveJSProperty("naturalHeight", image.height);
    await expect(photo(page)).toHaveCSS("object-fit", "contain");
    const src = await photo(page).getAttribute("src");
    expect(src).toMatch(/^blob:/);
    const blob = await page.evaluate(async (src) => {
        const value = await (await fetch(src)).blob();
        return {
            type: value.type,
            bytes: [...new Uint8Array(await value.arrayBuffer())],
        };
    }, src);
    expect(blob.type).toBe(image.mimeType);
    if (exactBytes && image.buffer)
        expect(Buffer.from(blob.bytes)).toEqual(image.buffer);
    await expect(
        dialog(page).getByRole("button", {
            name: retake ? "Retake" : "Choose Another",
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        dialog(page).getByRole("button", {
            name: retake ? "Choose Another" : "Retake",
            exact: true,
        }),
    ).toHaveCount(0);
    await expect(modalPaste(page)).toHaveAttribute("aria-label", PASTE_LABEL);
    await expect(modalPaste(page)).toHaveText("Paste");
    return src;
}

async function expectStatus(page, text, inModal = false) {
    const scope = inModal ? dialog(page) : page;
    await expect(
        scope.getByRole("status").filter({ hasText: text }),
    ).toHaveText(text);
}

// Several rendered frames catch late updates after a cancelled read, rather than
// accepting an immediate negative assertion before async validation can finish.
async function expectStablePreview(page, src) {
    await page.evaluate(async (src) => {
        for (let frame = 0; frame < 10; frame += 1) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
            const actual =
                document
                    .querySelector(".camodal__photo")
                    ?.getAttribute("src") ?? null;
            if (
                actual !== src ||
                (src === null && document.querySelector(".camodal__overlay"))
            ) {
                throw new Error(
                    "A stale clipboard operation changed or reopened the preview",
                );
            }
        }
    }, src);
}

async function syntheticPaste(
    page,
    { image = null, text = null, target = "body", prevented = false } = {},
) {
    return page.evaluate(
        ({ image, text, target, prevented }) => {
            const data = new DataTransfer();
            if (image)
                data.items.add(
                    new File([new Uint8Array(image.bytes)], image.name, {
                        type: image.mimeType,
                    }),
                );
            if (text !== null) data.setData("text/plain", text);
            const event = new ClipboardEvent("paste", {
                bubbles: true,
                cancelable: true,
                clipboardData: data,
            });
            if (prevented) event.preventDefault();
            document.querySelector(target).dispatchEvent(event);
            return event.defaultPrevented;
        },
        {
            image: image ? { ...clipboardItem(image), name: image.name } : null,
            text,
            target,
            prevented,
        },
    );
}

async function addEditableProbes(page) {
    // These are ordinary DOM controls, not application-source modifications.
    await page.locator(".camodal").evaluate((modal) => {
        for (const tag of ["input", "textarea", "select", "div"]) {
            const el = document.createElement(tag);
            el.id = `clipboard-probe-${tag}`;
            el.setAttribute("aria-label", `Clipboard guard ${tag}`);
            if (tag === "div") {
                el.contentEditable = "true";
                const child = document.createElement("span");
                child.id = "clipboard-probe-editable-child";
                child.textContent = "Keep this text";
                el.append(child);
            } else if (tag === "select") {
                el.add(new Option("Keep this text", "original"));
            } else el.value = "Keep this text";
            modal.append(el);
        }
    });
}

test("mocked read: Dashboard accepts PNG/JPEG/WebP without auto-predicting or resetting the model", async ({
    page,
    predictionRequests,
}) => {
    await expect(dashboardPaste(page)).toHaveAttribute(
        "aria-label",
        PASTE_LABEL,
    );
    await expect(dashboardPaste(page)).toHaveText("Paste");
    for (const [index, mimeType] of [
        "image/png",
        "image/jpeg",
        "image/webp",
    ].entries()) {
        await test.step(mimeType, async () => {
            const image = await canvasImage(page, {
                mimeType,
                width: 160 + index * 20,
                height: 96,
            });
            await mockRead(page, {
                items: [
                    { mimeType: "text/plain", text: "Image follows" },
                    clipboardItem(image),
                ],
            });
            await dashboardPaste(page).click();
            await expectPreview(page, image);
            expect(await readCalls(page)).toBe(1);
            await expect(picker(page)).toHaveValue(index === 0 ? "v1" : "v2");
            if (index === 0) await selectV2(page);
            expect(predictionRequests).toHaveLength(0);
            await page.locator(".camodal__close").click();
            await expect(dialog(page)).toHaveCount(0);
        });
    }
});

test("mocked read: modal Paste replaces the actual uploaded photo and preserves V2", async ({
    page,
    predictionRequests,
}) => {
    const original = await canvasImage(page);
    const oldSrc = await uploadPreview(page, original);
    await selectV2(page);
    const replacement = await canvasImage(page, { width: 90, height: 180 });
    await mockRead(page, { items: [clipboardItem(replacement)] });
    await modalPaste(page).click();
    const newSrc = await expectPreview(page, replacement);
    expect(newSrc).not.toBe(oldSrc);
    await expect(picker(page)).toHaveValue("v2");
    await expect.poll(() => revoked(page, oldSrc)).toBe(1);
    expect(await revoked(page, newSrc)).toBe(0);
    expect(predictionRequests).toHaveLength(0);
});

test("synthetic ClipboardEvent: images are handled only while the modal is open, without read()", async ({
    page,
    predictionRequests,
}) => {
    const image = await canvasImage(page, { width: 120, height: 180 });
    await mockRead(page, { errorName: "NotAllowedError" });
    expect(await syntheticPaste(page, { image })).toBe(false);
    await expect(dialog(page)).toHaveCount(0);
    await uploadPreview(page, await canvasImage(page));
    await selectV2(page);
    expect(
        await syntheticPaste(page, { image, text: "An image with text" }),
    ).toBe(true);
    await expectPreview(page, image);
    await expect(picker(page)).toHaveValue("v2");
    expect(await readCalls(page)).toBe(0);
    await page.locator(".camodal__close").click();
    expect(await syntheticPaste(page, { image })).toBe(false);
    await expectStablePreview(page, null);
    expect(predictionRequests).toHaveLength(0);
});

test("synthetic ClipboardEvent: text stays unprevented; editable and defaultPrevented targets are ignored", async ({
    page,
    predictionRequests,
}) => {
    const src = await uploadPreview(page, await canvasImage(page));
    const replacement = await canvasImage(page, { width: 96, height: 160 });
    await mockRead(page, { errorName: "NotAllowedError" });
    await addEditableProbes(page);
    for (const target of [
        "#clipboard-probe-input",
        "#clipboard-probe-textarea",
        "#clipboard-probe-select",
        "#clipboard-probe-editable-child",
    ]) {
        expect(await syntheticPaste(page, { image: replacement, target })).toBe(
            false,
        );
        expect(
            await syntheticPaste(page, { text: "Ordinary text", target }),
        ).toBe(false);
    }
    expect(
        await syntheticPaste(page, { image: replacement, prevented: true }),
    ).toBe(true);
    await expectStablePreview(page, src);
    await expect(
        dialog(page).getByRole("status").filter({ hasText: MESSAGES.empty }),
    ).toHaveCount(0);
    await expect(page.locator("#clipboard-probe-input")).toHaveValue(
        "Keep this text",
    );
    await expect(page.locator("#clipboard-probe-textarea")).toHaveValue(
        "Keep this text",
    );
    await expect(page.locator("#clipboard-probe-select")).toHaveValue(
        "original",
    );
    await expect(page.locator("#clipboard-probe-editable-child")).toHaveText(
        "Keep this text",
    );
    expect(await syntheticPaste(page, { text: "Not an image" })).toBe(false);
    await expectStatus(page, MESSAGES.empty, true);
    expect(await readCalls(page)).toBe(0);
    expect(predictionRequests).toHaveLength(0);
});

test("mocked read: empty and text-only clipboards show the friendly status, not a modal", async ({
    page,
    predictionRequests,
}) => {
    for (const items of [[], [{ mimeType: "text/plain", text: "Rice leaf" }]]) {
        await mockRead(page, { items });
        await dashboardPaste(page).click();
        await expectStatus(page, MESSAGES.empty);
        await expect(dashboardPaste(page)).toBeEnabled();
        await expect(dashboardPaste(page)).not.toHaveAttribute(
            "aria-busy",
            "true",
        );
        await expect(dialog(page)).toHaveCount(0);
        expect(await readCalls(page)).toBe(1);
    }
    expect(predictionRequests).toHaveLength(0);
});

test("mocked capability: missing clipboard/read gives guidance while keyboard image paste still works", async ({
    page,
    predictionRequests,
}) => {
    for (const unavailable of ["clipboard", "read"]) {
        await mockRead(page, { unavailable });
        await dashboardPaste(page).click();
        await expectStatus(page, MESSAGES.unavailable);
        await expect(dialog(page)).toHaveCount(0);
    }
    await uploadPreview(page, await canvasImage(page));
    const replacement = await canvasImage(page, { width: 100, height: 150 });
    expect(await syntheticPaste(page, { image: replacement })).toBe(true);
    await expectPreview(page, replacement);
    expect(await readCalls(page)).toBe(0);
    expect(predictionRequests).toHaveLength(0);
});

test("mocked denial: blocked reads show actionable status and leave the current V2 preview intact", async ({
    page,
    predictionRequests,
}) => {
    await mockRead(page, { errorName: "NotAllowedError" });
    await dashboardPaste(page).click();
    await expectStatus(page, MESSAGES.denied);
    await expect(dialog(page)).toHaveCount(0);
    const src = await uploadPreview(page, await canvasImage(page));
    await selectV2(page);
    await modalPaste(page).click();
    await expectStatus(page, MESSAGES.denied, true);
    await expect(photo(page)).toHaveAttribute("src", src);
    await expect(picker(page)).toHaveValue("v2");
    await expect(modalPaste(page)).toBeEnabled();
    expect(await revoked(page, src)).toBe(0);
    expect(predictionRequests).toHaveLength(0);
});

test("mocked validation: corrupt, unsupported and over-10-MiB images cannot replace a valid preview", async ({
    page,
    predictionRequests,
}) => {
    const original = await canvasImage(page);
    const src = await uploadPreview(page, original);
    await selectV2(page);
    const valid = clipboardItem(original);
    for (const [name, item, message] of [
        [
            "corrupt PNG",
            {
                mimeType: "image/png",
                bytes: [...Buffer.from("not a decodable image")],
            },
            MESSAGES.invalid,
        ],
        [
            "unsupported MIME",
            { ...valid, mimeType: "image/gif" },
            MESSAGES.unsupported,
        ],
        [
            "oversized PNG",
            { ...valid, size: 10 * 1024 * 1024 + 1 },
            MESSAGES.large,
        ],
    ]) {
        await test.step(name, async () => {
            await mockRead(page, { items: [item] });
            await modalPaste(page).click();
            await expectStatus(page, message, true);
            await expect(modalPaste(page)).toBeEnabled();
            await expect(photo(page)).toHaveAttribute("src", src);
            await expect(picker(page)).toHaveValue("v2");
            expect(await revoked(page, src)).toBe(0);
        });
    }
    expect(predictionRequests).toHaveLength(0);
});

test("mocked deferred read: both Paste buttons expose busy/disabled state and reject duplicate image handling", async ({
    page,
    predictionRequests,
}) => {
    const original = await canvasImage(page);
    const src = await uploadPreview(page, original);
    await selectV2(page);
    const replacement = await canvasImage(page, { width: 100, height: 180 });
    await mockRead(page, {
        items: [clipboardItem(replacement)],
        deferred: true,
    });
    await modalPaste(page).click();
    for (const button of [dashboardPaste(page), modalPaste(page)]) {
        await expect(button).toBeDisabled();
        await expect(button).toHaveAttribute("aria-busy", "true");
        await button.evaluate((el) => {
            el.click();
            el.click();
        });
    }
    await syntheticPaste(page, { image: original });
    await expectStablePreview(page, src);
    expect(await readCalls(page)).toBe(1);
    await releaseRead(page);
    await expectPreview(page, replacement);
    await expect(picker(page)).toHaveValue("v2");
    for (const button of [dashboardPaste(page), modalPaste(page)]) {
        await expect(button).toBeEnabled();
        await expect(button).not.toHaveAttribute("aria-busy", "true");
    }
    await page.locator(".camodal__close").click();
    await mockRead(page, { items: [clipboardItem(original)], deferred: true });
    await dashboardPaste(page).click();
    await expect(dashboardPaste(page)).toBeDisabled();
    await expect(dashboardPaste(page)).toHaveAttribute("aria-busy", "true");
    await expect(dialog(page)).toHaveCount(0);
    await dashboardPaste(page).evaluate((el) => {
        el.click();
        el.click();
    });
    expect(await readCalls(page)).toBe(1);
    await releaseRead(page);
    await expectPreview(page, original);
    expect(predictionRequests).toHaveLength(0);
});

test("mocked deferred read: Close and Escape invalidate late successes/errors without reopening", async ({
    page,
    predictionRequests,
}) => {
    const image = await canvasImage(page);
    for (const errorName of [null, "NotAllowedError"]) {
        await uploadPreview(page, image);
        await mockRead(page, {
            items: [clipboardItem(image)],
            errorName,
            deferred: true,
        });
        await modalPaste(page).click();
        await expect(modalPaste(page)).toBeDisabled();
        if (errorName) await page.keyboard.press("Escape");
        else await page.locator(".camodal__close").click();
        await expect(dialog(page)).toHaveCount(0);
        await releaseRead(page);
        await expectStablePreview(page, null);
        await expect(dashboardPaste(page)).toBeEnabled();
        await expect(
            page.getByRole("status").filter({ hasText: MESSAGES.denied }),
        ).toHaveCount(0);
    }
    await mockRead(page, { items: [clipboardItem(image)] });
    await dashboardPaste(page).click();
    await expectPreview(page, image);
    expect(predictionRequests).toHaveLength(0);
});

test("native file chooser: Upload Photo/Choose Another work, reset the input, and supersede a pending clipboard read", async ({
    page,
    predictionRequests,
}) => {
    const original = await canvasImage(page);
    await chooseFile(
        page,
        page
            .locator(".dashboard-diagnosis-card")
            .getByRole("button", { name: "Upload Photo", exact: true }),
        original,
    );
    await expectPreview(page, original);
    await selectV2(page);
    await mockRead(page, { items: [clipboardItem(original)] });
    await modalPaste(page).click();
    await expectPreview(page, original);
    await mockRead(page, { items: [clipboardItem(original)], deferred: true });
    await modalPaste(page).click();
    const replacement = await canvasImage(page, { width: 100, height: 180 });
    const chooseAnother = dialog(page).getByRole("button", {
        name: "Choose Another",
        exact: true,
    });
    await chooseFile(page, chooseAnother, replacement);
    const src = await expectPreview(page, replacement);
    await releaseRead(page);
    await expectStablePreview(page, src);
    await expect(picker(page)).toHaveValue("v2");
    await chooseFile(page, chooseAnother, replacement);
    const secondSrc = await expectPreview(page, replacement);
    expect(secondSrc).not.toBe(src);
    await expect.poll(() => revoked(page, src)).toBe(1);
    expect(predictionRequests).toHaveLength(0);
});

test("preview URL ownership: replacement, close and same-document Dashboard unmount each revoke exactly once", async ({
    page,
    predictionRequests,
}) => {
    const image = await canvasImage(page);
    await mockRead(page, { items: [clipboardItem(image)] });
    await dashboardPaste(page).click();
    const first = await expectPreview(page, image);
    await modalPaste(page).click();
    await expect(photo(page)).not.toHaveAttribute("src", first);
    const second = await expectPreview(page, image);
    await expect.poll(() => revoked(page, first)).toBe(1);
    expect(await revoked(page, second)).toBe(0);
    await page.locator(".camodal__close").click();
    await expect.poll(() => revoked(page, second)).toBe(1);
    await dashboardPaste(page).click();
    const third = await expectPreview(page, image);
    await mockRead(page, { items: [clipboardItem(image)], deferred: true });
    await modalPaste(page).click();
    await expect(modalPaste(page)).toBeDisabled();
    // Same-document routing preserves the observational URL wrappers on unmount.
    await page.evaluate((path) => {
        history.pushState({}, "", path);
        window.dispatchEvent(new PopStateEvent("popstate"));
    }, new URL("disease", APP_URL).pathname);
    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(() => revoked(page, third)).toBe(1);
    await releaseRead(page);
    await expectStablePreview(page, null);
    expect(await revoked(page, first)).toBe(1);
    expect(await revoked(page, second)).toBe(1);
    expect(predictionRequests).toHaveLength(0);
});

for (const model of ["v1", "v2"]) {
    test(`mocked prediction: Analyze sends the clipboard image only to the unchanged ${model.toUpperCase()} POST path`, async ({
        page,
        predictionRequests,
    }) => {
        const image = await canvasImage(page);
        await mockRead(page, { items: [clipboardItem(image)] });
        await dashboardPaste(page).click();
        const src = await expectPreview(page, image);
        await expect(picker(page)).toHaveValue("v1");
        if (model === "v2") await selectV2(page);
        expect(predictionRequests).toHaveLength(0);
        const expectedPath =
            model === "v2"
                ? "/Agri_Dr/api/disease/v2/predict"
                : "/disease/predict";
        const requestPromise = page.waitForRequest(
            (request) =>
                new URL(request.url()).pathname === expectedPath &&
                request.method() === "POST",
        );
        await dialog(page)
            .getByRole("button", { name: "Analyze", exact: true })
            .click();
        const request = await requestPromise;
        expect(request.headers()["content-type"]).toContain(
            "multipart/form-data",
        );
        const body = request.postDataBuffer();
        expect(body).not.toBeNull();
        expect(body.toString("latin1")).toContain('name="file"; filename="');
        expect(body.toString("latin1")).toContain("Content-Type: image/png");
        expect(body.includes(image.buffer)).toBe(true);
        await expect(page.locator(".camodal__analysis")).toContainText(
            "Uncertain prediction",
        );
        await expect(
            page
                .locator(".camodal__analysis")
                .getByText("40%", { exact: true }),
        ).toBeVisible();
        if (model === "v2")
            await expect(
                page.getByText("Model version: " + READY_STATUS.model_version, {
                    exact: true,
                }),
            ).toBeVisible();
        expect(predictionRequests).toHaveLength(1);
        expect(new URL(predictionRequests[0].url()).pathname).toBe(
            expectedPath,
        );
        await expect(page.locator(".camodal__thumb")).toHaveAttribute(
            "src",
            src,
        );
        await page.locator(".camodal__close").click();
        await expectPreview(page, image);
        await expect(picker(page)).toHaveValue(model);
        expect(predictionRequests).toHaveLength(1);
    });
}

test("native clipboard (capability-dependent): real write/read, trusted image shortcut, and ordinary input text paste", async ({
    page,
    context,
    browserName,
    predictionRequests,
}) => {
    test.skip(
        browserName !== "chromium",
        "Native clipboard permission names are Chromium-specific",
    );
    const supported = await page.evaluate(
        () =>
            window.isSecureContext &&
            typeof ClipboardItem === "function" &&
            typeof navigator.clipboard?.write === "function" &&
            typeof navigator.clipboard?.read === "function",
    );
    test.skip(
        !supported,
        "This browser/secure context does not expose native image clipboard APIs",
    );
    const first = await canvasImage(page);
    let nativeImage;
    try {
        await context.grantPermissions(["clipboard-read", "clipboard-write"], {
            origin: new URL(BASE).origin,
        });
        await page.bringToFront();
        nativeImage = await page.evaluate(
            async (bytes) => {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        "image/png": new Blob([new Uint8Array(bytes)], {
                            type: "image/png",
                        }),
                    }),
                ]);
                const items = await navigator.clipboard.read();
                const item = items.find((value) =>
                    value.types.includes("image/png"),
                );
                if (!item) return null;
                const bitmap = await createImageBitmap(
                    await item.getType("image/png"),
                );
                const dimensions = {
                    width: bitmap.width,
                    height: bitmap.height,
                };
                bitmap.close();
                return dimensions;
            },
            [...first.buffer],
        );
    } catch (error) {
        test.skip(
            true,
            `Native clipboard setup is unavailable on this host: ${String(error).slice(0, 180)}`,
        );
    }
    expect(nativeImage).toEqual({ width: first.width, height: first.height });
    await dashboardPaste(page).click();
    await expectPreview(page, first, { exactBytes: false });
    await selectV2(page);
    const second = await canvasImage(page, { width: 100, height: 180 });
    await page.evaluate(
        async (bytes) => {
            await navigator.clipboard.write([
                new ClipboardItem({
                    "image/png": new Blob([new Uint8Array(bytes)], {
                        type: "image/png",
                    }),
                }),
            ]);
            window.__nativeImagePaste = null;
            document.addEventListener(
                "paste",
                (event) => {
                    window.__nativeImagePaste = {
                        trusted: event.isTrusted,
                        types: [...(event.clipboardData?.files || [])].map(
                            (file) => file.type,
                        ),
                    };
                },
                { once: true, capture: true },
            );
        },
        [...second.buffer],
    );
    await modalPaste(page).focus();
    await page.keyboard.press(PASTE_SHORTCUT);
    await expect
        .poll(() => page.evaluate(() => window.__nativeImagePaste))
        .not.toBeNull();
    const nativePaste = await page.evaluate(() => window.__nativeImagePaste);
    expect(nativePaste.trusted).toBe(true);
    test.skip(
        !nativePaste.types.includes("image/png"),
        "This host's real paste shortcut does not expose an image file",
    );
    const src = await expectPreview(page, second, { exactBytes: false });
    await addEditableProbes(page);
    await page.evaluate(() => navigator.clipboard.writeText("native text"));
    const input = page.getByRole("textbox", {
        name: "Clipboard guard input",
        exact: true,
    });
    await input.fill("Keep ");
    await input.press("End");
    await page.keyboard.press(PASTE_SHORTCUT);
    await expect(input).toHaveValue("Keep native text");
    await expect(photo(page)).toHaveAttribute("src", src);
    await expect(picker(page)).toHaveValue("v2");
    await expect(
        dialog(page).getByRole("status").filter({ hasText: MESSAGES.empty }),
    ).toHaveCount(0);
    expect(predictionRequests).toHaveLength(0);
});

test.describe("native Chromium fake-camera regression", () => {
    test.use({ permissions: ["camera"] });

    test("Take Photo/capture/Retake still use native media and stop tracks; pasted replacement uses Choose Another", async ({
        page,
        predictionRequests,
    }) => {
        await page
            .locator(".dashboard-diagnosis-card")
            .getByRole("button", { name: "Take Photo", exact: true })
            .click();
        let firstSrc;
        for (let capture = 0; capture < 2; capture += 1) {
            const video = page.locator(".camodal__video");
            await expect(video).toBeVisible();
            await expect
                .poll(() =>
                    video.evaluate(
                        (el) => el.videoWidth > 0 && el.readyState >= 2,
                    ),
                )
                .toBe(true);
            const dimensions = await video.evaluate((el) => {
                window.__cameraTracks = [
                    ...(window.__cameraTracks || []),
                    ...el.srcObject.getTracks(),
                ];
                return {
                    width: el.videoWidth,
                    height: el.videoHeight,
                    mimeType: "image/jpeg",
                };
            });
            await page.locator(".camodal__shutter").click();
            const src = await expectPreview(page, dimensions, { retake: true });
            await expect
                .poll(() =>
                    page.evaluate(() =>
                        window.__cameraTracks.every(
                            (track) => track.readyState === "ended",
                        ),
                    ),
                )
                .toBe(true);
            await expect(
                page.locator(".camodal__preview-buttons button"),
            ).toHaveText(["Retake", "Paste", "Analyze"]);
            if (capture === 0) {
                firstSrc = src;
                await selectV2(page);
                await dialog(page)
                    .getByRole("button", { name: "Retake", exact: true })
                    .click();
            }
        }
        await expect.poll(() => revoked(page, firstSrc)).toBe(1);
        await expect(picker(page)).toHaveValue("v2");
        const image = await canvasImage(page);
        await mockRead(page, { items: [clipboardItem(image)] });
        await modalPaste(page).click();
        await expectPreview(page, image);
        await expect(picker(page)).toHaveValue("v2");
        expect(predictionRequests).toHaveLength(0);
    });
    test("voice Take Photo cancels a pending paste before opening the camera", async ({
        page,
        predictionRequests,
    }) => {
        const image = await canvasImage(page);
        await mockRead(page, { items: [clipboardItem(image)], deferred: true });
        await dashboardPaste(page).click();
        await expect(dashboardPaste(page)).toBeDisabled();
        await page.evaluate(() =>
            window.dispatchEvent(new CustomEvent("krisiveda:voice-take-photo")),
        );
        const video = page.locator(".camodal__video");
        await expect(video).toBeVisible();
        await releaseRead(page);
        await page.evaluate(async () => {
            for (let frame = 0; frame < 10; frame += 1) {
                await new Promise((resolve) => requestAnimationFrame(resolve));
                if (
                    !document.querySelector(".camodal__video") ||
                    document.querySelector(".camodal__photo")
                ) {
                    throw new Error(
                        "A stale clipboard read replaced the camera preview",
                    );
                }
            }
        });
        await expect(video).toBeVisible();
        await expect(photo(page)).toHaveCount(0);
        await expect(dashboardPaste(page)).toBeEnabled();
        expect(predictionRequests).toHaveLength(0);
    });
});

for (const width of [320, 375, 768, 1280]) {
    test(`layout ${width}px: compact Dashboard CTA and one-row preview actions fit, in order, without stretching images`, async ({
        page,
        predictionRequests,
    }) => {
        await page.setViewportSize({ width, height: 720 });
        // Wait for the responsive React branch to commit before using its nodes.
        await expect(page.locator(".dashboard-mobile-pair")).toHaveCount(
            width <= 900 ? 1 : 0,
        );
        const cta = page.locator(".dashboard-diagnosis-cta");
        await cta.scrollIntoViewIfNeeded();
        const dashboardFits = await cta.evaluate((el) => {
            const bounds = el.getBoundingClientRect();
            return (
                el.scrollWidth <= el.clientWidth + 1 &&
                [...el.querySelectorAll("button")].every((button) => {
                    const box = button.getBoundingClientRect();
                    return (
                        box.left >= bounds.left - 1 &&
                        box.right <= bounds.right + 1 &&
                        button.scrollWidth <= button.clientWidth + 1
                    );
                })
            );
        });
        expect(dashboardFits).toBe(true);
        for (const dimensions of [
            { width: 90, height: 180 },
            { width: 240, height: 120 },
        ]) {
            const image = await canvasImage(page, dimensions);
            await mockRead(page, { items: [clipboardItem(image)] });
            if (await dialog(page).count()) await modalPaste(page).click();
            else await dashboardPaste(page).click();
            await expectPreview(page, image);
            await expect(
                page.locator(".camodal__preview-buttons button"),
            ).toHaveText(["Choose Another", "Paste", "Analyze"]);
            await expect(picker(page).locator("option")).toHaveText([
                "Existing Model (6 Classes)",
                "Advanced Model (15 Classes)",
                "Browser Model (15 Classes)",
            ]);
            await expect(picker(page)).toHaveValue("v1");
            const layout = await page
                .locator(".camodal")
                .evaluate(async (modal) => {
                    await Promise.all(
                        modal
                            .getAnimations({ subtree: true })
                            .map((animation) => animation.finished),
                    );
                    const box = (el) => {
                        const r = el.getBoundingClientRect();
                        return {
                            left: r.left,
                            right: r.right,
                            top: r.top,
                            bottom: r.bottom,
                            width: r.width,
                            height: r.height,
                        };
                    };
                    const strip = modal.querySelector(
                        ".camodal__preview-buttons",
                    );
                    const buttons = [...strip.querySelectorAll("button")];
                    const panel = box(modal);
                    const frameElement = modal.querySelector(
                        ".camodal__photo-frame",
                    );
                    const frame = box(frameElement);
                    const frameStyle = getComputedStyle(frameElement);
                    const image = box(modal.querySelector(".camodal__photo"));
                    return {
                        panel,
                        frame,
                        frameAspectRatio: frameStyle.aspectRatio,
                        frameMaxHeight: parseFloat(frameStyle.maxHeight),
                        image,
                        strip: box(strip),
                        buttons: buttons.map(box),
                        picker: box(
                            modal.querySelector(".camodal__model-picker"),
                        ),
                        noHorizontalOverflow:
                            modal.scrollWidth <= modal.clientWidth + 1 &&
                            strip.scrollWidth <= strip.clientWidth + 1 &&
                            buttons.every(
                                (button) =>
                                    button.scrollWidth <=
                                    button.clientWidth + 1,
                            ),
                        documentFits:
                            document.documentElement.scrollWidth <=
                            innerWidth + 1,
                    };
                });
            expect(layout.noHorizontalOverflow).toBe(true);
            expect(layout.documentFits).toBe(true);
            expect(layout.panel.left).toBeGreaterThanOrEqual(0);
            expect(layout.panel.right).toBeLessThanOrEqual(width + 1);
            expect(layout.panel.top).toBeGreaterThanOrEqual(0);
            expect(layout.panel.bottom).toBeLessThanOrEqual(721);
            expect(layout.picker.bottom).toBeLessThanOrEqual(
                layout.strip.top + 2,
            );
            const mobile = width <= 600;
            const preferredRatio = mobile ? 3 / 4 : 4 / 3;
            expect(layout.frameAspectRatio).toBe(mobile ? "3 / 4" : "4 / 3");
            expect(layout.frameMaxHeight).toBeCloseTo(
                720 * (mobile ? 0.58 : 0.56),
                1,
            );
            // The vh cap and flex sizing can shorten the preferred-ratio frame;
            // object-fit: contain and natural dimensions above guard the image.
            expect(layout.frame.height).toBeGreaterThan(0);
            expect(layout.frame.height).toBeLessThanOrEqual(
                Math.min(
                    layout.frame.width / preferredRatio,
                    layout.frameMaxHeight,
                ) + 3,
            );
            expect(
                Math.abs(layout.image.width - layout.frame.width),
            ).toBeLessThanOrEqual(3);
            expect(
                Math.abs(layout.image.height - layout.frame.height),
            ).toBeLessThanOrEqual(3);
            for (const [index, button] of layout.buttons.entries()) {
                expect(
                    Math.abs(button.top - layout.buttons[0].top),
                ).toBeLessThanOrEqual(2);
                expect(
                    Math.abs(button.height - layout.buttons[0].height),
                ).toBeLessThanOrEqual(2);
                expect(button.left).toBeGreaterThanOrEqual(layout.panel.left);
                expect(button.right).toBeLessThanOrEqual(layout.panel.right);
                expect(button.bottom).toBeLessThanOrEqual(layout.panel.bottom);
                if (index)
                    expect(button.left).toBeGreaterThanOrEqual(
                        layout.buttons[index - 1].right - 1,
                    );
            }
        }
        expect(predictionRequests).toHaveLength(0);
    });
}

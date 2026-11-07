import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const STATUS_PATH = "/Agri_Dr/api/disease/v2/status";
const readyStatus = {
    available: true,
    classes: 15,
    model_version: "rice-disease-warmstart-v1",
    production: false,
};
const leaf = {
    name: "leaf.png",
    mimeType: "image/png",
    buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9uoAAAAASUVORK5CYII=",
        "base64",
    ),
};

// Use the application's public guest-browsing path; no session or backend model changes.
test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem("krisiveda.guest", "1");
        localStorage.setItem("krisiveda-lang", "en");
    });
});

async function openPreview(page) {
    await page.goto(BASE + "/Agri_Dr/");
    await page
        .locator('input[type="file"][accept="image/*"]')
        .setInputFiles(leaf);
    await expect(
        page.getByRole("combobox", { name: "Analysis model" }),
    ).toHaveValue("v1");
}

test("ready development model enables V2 while leaving V1 selected and predicting on the V2 path", async ({
    page,
}) => {
    await page.route("**" + STATUS_PATH, (route) =>
        route.fulfill({ json: readyStatus }),
    );
    await page.route("**/disease/v2/predict", (route) =>
        route.fulfill({
            json: {
                status: "uncertain",
                confidence: 0.4,
                top_predictions: [],
                model_version: readyStatus.model_version,
            },
        }),
    );
    await openPreview(page);
    const picker = page.getByRole("combobox", { name: "Analysis model" });
    await expect(picker.locator('option[value="v2"]')).toHaveJSProperty(
        "disabled",
        false,
    );
    await picker.selectOption("v2");
    const requestPromise = page.waitForRequest((request) =>
        request.url().endsWith("/Agri_Dr/api/disease/v2/predict"),
    );
    await page.getByRole("button", { name: "Analyze", exact: true }).click();
    const request = await requestPromise;
    expect(request.method()).toBe("POST");
    expect(request.headers()["content-type"]).toContain("multipart/form-data");
    expect(request.postDataBuffer().toString()).toContain(
        'filename="leaf.png"',
    );
    await expect(
        page.getByText("Model version: " + readyStatus.model_version),
    ).toBeVisible();
});

for (const [name, response] of [
    ["unavailable backend", { available: false, classes: 15 }],
    ["wrong class count", { available: true, classes: 6 }],
    ["string class count", { available: true, classes: "15" }],
    ["string availability", { available: "true", classes: 15 }],
    ["missing availability fields", {}],
    ["null response", null],
]) {
    test(`keeps V2 disabled and V1 selected for ${name}`, async ({ page }) => {
        await page.route("**" + STATUS_PATH, (route) =>
            route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(response),
            }),
        );
        await openPreview(page);
        await expect(
            page
                .getByRole("combobox", { name: "Analysis model" })
                .locator('option[value="v2"]'),
        ).toHaveJSProperty("disabled", true);
    });
}

for (const failure of ["http", "network", "json"]) {
    test(`keeps V2 disabled after a ${failure} status failure`, async ({
        page,
    }) => {
        await page.route("**" + STATUS_PATH, (route) => {
            if (failure === "network") return route.abort("failed");
            return route.fulfill({
                status: failure === "http" ? 503 : 200,
                body: "not JSON",
            });
        });
        await openPreview(page);
        await expect(
            page
                .getByRole("combobox", { name: "Analysis model" })
                .locator('option[value="v2"]'),
        ).toHaveJSProperty("disabled", true);
    });
}

test("default analysis still sends V1 to the configured API, not the development V2 proxy", async ({
    page,
}) => {
    await page.route("**" + STATUS_PATH, (route) =>
        route.fulfill({ json: readyStatus }),
    );
    let predictionUrl;
    await page.route("**/disease/predict", (route) => {
        predictionUrl = route.request().url();
        return route.fulfill({
            json: { status: "uncertain", confidence: 0.4, top_predictions: [] },
        });
    });
    await openPreview(page);

    await page.getByRole("button", { name: "Analyze", exact: true }).click();
    await expect.poll(() => predictionUrl).toBeTruthy();
    expect(new URL(predictionUrl).pathname).toBe("/disease/predict");
    expect(predictionUrl).not.toContain("/Agri_Dr/api/");
});

test("live local V2 status enables the actual dropdown through the development proxy", async ({
    page,
}) => {
    test.skip(
        process.env.KRISIVEDA_TEST_LIVE_V2 !== "1",
        "Opt in when the local V2 backend is running on port 8000",
    );
    const responsePromise = page.waitForResponse((response) =>
        response.url().endsWith(STATUS_PATH),
    );
    await openPreview(page);
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject(readyStatus);
    await expect(
        page
            .getByRole("combobox", { name: "Analysis model" })
            .locator('option[value="v2"]'),
    ).toHaveJSProperty("disabled", false);
});

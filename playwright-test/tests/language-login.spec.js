import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const APP_PATH = "/Agri_Dr/";

const LANGUAGES = [
    {
        code: "en",
        nativeName: "English",
        expected: {
            heading: "Welcome back",
            subtitle: "Sign in to continue to Krisiveda",
            emailLabel: "Email",
            passwordLabel: "Password",
            loginButton: "Login",
            googleButton: "Continue with Google",
            signupLink: "Sign up",
            skipButton: "Skip for now",
            signupHeading: "Create your account",
        },
    },
    {
        code: "bn",
        nativeName: "বাংলা",
        expected: {
            heading: "স্বাগতম",
            subtitle: "Krisiveda-তে চালিয়ে যেতে সাইন ইন করুন",
            emailLabel: "ইমেইল",
            passwordLabel: "পাসওয়ার্ড",
            loginButton: "লগ ইন",
            googleButton: "Google দিয়ে চালিয়ে যান",
            signupLink: "সাইন আপ করুন",
            skipButton: "এখন এড়িয়ে যান",
            signupHeading: "আপনার অ্যাকাউন্ট তৈরি করুন",
        },
    },
    {
        code: "hi",
        nativeName: "हिन्दी",
        expected: {
            heading: "वापसी पर स्वागत है",
            subtitle: "Krisiveda में जारी रखने के लिए साइन इन करें",
            emailLabel: "ईमेल",
            passwordLabel: "पासवर्ड",
            loginButton: "लॉग इन",
            googleButton: "Google से जारी रखें",
            signupLink: "साइन अप करें",
            skipButton: "अभी छोड़ें",
            signupHeading: "अपना खाता बनाएं",
        },
    },
    {
        code: "te",
        nativeName: "తెలుగు",
        expected: {
            heading: "తిరిగి స్వాగతం",
            subtitle: "Krisivedaలో కొనసాగడానికి సైన్ ఇన్ చేయండి",
            emailLabel: "ఇమెయిల్",
            passwordLabel: "పాస్‌వర్డ్",
            loginButton: "లాగిన్",
            googleButton: "Googleతో కొనసాగించండి",
            signupLink: "సైన్ అప్ చేయండి",
            skipButton: "ఇప్పుడు దాటవేయి",
            signupHeading: "మీ ఖాతాను సృష్టించండి",
        },
    },
    {
        code: "ta",
        nativeName: "தமிழ்",
        expected: {
            heading: "மீண்டும் வருக",
            subtitle: "Krisiveda-வில் தொடர உள்நுழையவும்",
            emailLabel: "மின்னஞ்சல்",
            passwordLabel: "கடவுச்சொல்",
            loginButton: "உள்நுழைவு",
            googleButton: "Google மூலம் தொடரவும்",
            signupLink: "பதிவு செய்யவும்",
            skipButton: "இப்போது தவிர்க்கவும்",
            signupHeading: "உங்கள் கணக்கை உருவாக்கவும்",
        },
    },
];

test.describe("KRISIVEDA Language Selection and Login Navigation Flow", () => {
    for (const lang of LANGUAGES) {
        test(`flow for ${lang.nativeName} (${lang.code}): select language -> Continue -> translated Login -> persist across refresh & Signup`, async ({
            page,
        }) => {
            // Step 1: Open website as first-time visitor (fresh context has empty storage)
            await page.goto(`${BASE}${APP_PATH}login`, {
                waitUntil: "domcontentloaded",
            });

            // Verify Language selection screen is shown
            const langGrid = page.locator(".obw-lang-grid");
            await expect(langGrid).toBeVisible({ timeout: 15000 });

            // Select language
            const langButton = page.locator(".obw-lang", {
                hasText: lang.nativeName,
            });
            await expect(langButton).toBeVisible();
            await langButton.click();

            // Verify the selected button is active
            await expect(langButton).toHaveClass(/obw-lang--active/);

            // Verify still on gate before Continue (no premature navigation)
            await expect(langGrid).toBeVisible();

            // Step 2: Click Continue
            const continueBtn = page.locator(".obw-lang-continue");
            await expect(continueBtn).toBeEnabled();
            await continueBtn.click();

            // Step 3 & 4 & 5: Verify Login screen opens and displays elements in selected language
            await expect(page.locator(".obw-lang-grid")).not.toBeVisible({
                timeout: 10000,
            });
            await expect(page.locator(".auth-card__title")).toHaveText(
                lang.expected.heading,
            );
            await expect(page.locator(".auth-card__subtitle")).toHaveText(
                lang.expected.subtitle,
            );

            // Verify Email and Password field labels
            const emailField = page.locator(".auth-field", {
                has: page.locator('input[type="email"]'),
            });
            await expect(emailField.locator(".auth-field__label")).toHaveText(
                lang.expected.emailLabel,
            );

            const passwordField = page.locator(".auth-field", {
                has: page.locator("input#login-password"),
            });
            await expect(
                passwordField.locator(".auth-field__label"),
            ).toHaveText(lang.expected.passwordLabel);

            // Verify buttons
            const submitBtn = page.locator(
                'button[type="submit"].auth-btn--primary',
            );
            await expect(submitBtn).toHaveText(lang.expected.loginButton);

            const googleBtn = page.locator(".auth-btn--google");
            await expect(googleBtn).toContainText(lang.expected.googleButton);

            const skipBtn = page.locator(".auth-skip-external");
            await expect(skipBtn).toHaveText(lang.expected.skipButton);

            // Verify Sign up link
            const signupLink = page.locator(
                '.auth-card__footer a[href*="signup"]',
            );
            await expect(signupLink).toHaveText(lang.expected.signupLink);

            // Verify localStorage persistence
            const savedLang = await page.evaluate(() =>
                localStorage.getItem("krisiveda-lang"),
            );
            expect(savedLang).toBe(lang.code);

            // Step 6: Refresh the login screen and verify language remains unchanged
            await page.reload({ waitUntil: "domcontentloaded" });
            await expect(page.locator(".obw-lang-grid")).not.toBeVisible();
            await expect(page.locator(".auth-card__title")).toHaveText(
                lang.expected.heading,
            );
            await expect(page.locator(".auth-card__subtitle")).toHaveText(
                lang.expected.subtitle,
            );
            await expect(submitBtn).toHaveText(lang.expected.loginButton);

            // Step 7: Navigate between Login and Signup and verify language persistence
            await signupLink.click();
            await expect(page).toHaveURL(/.*\/signup/);
            await expect(page.locator(".obw-lang-grid")).not.toBeVisible();
            await expect(page.locator(".auth-card__title")).toHaveText(
                lang.expected.signupHeading,
            );

            // Navigate back to Login
            const loginLink = page.locator(
                '.auth-card__footer a[href*="login"]',
            );
            await loginLink.click();
            await expect(page).toHaveURL(/.*\/login/);
            await expect(page.locator(".auth-card__title")).toHaveText(
                lang.expected.heading,
            );
        });
    }

    test("English first-click without touching grid works directly", async ({
        page,
    }) => {
        await page.goto(`${BASE}${APP_PATH}login`, {
            waitUntil: "domcontentloaded",
        });

        // Verify English is pre-selected
        const enButton = page.locator(".obw-lang", { hasText: "English" });
        await expect(enButton).toHaveClass(/obw-lang--active/);

        // Click Continue immediately without clicking the English card first
        const continueBtn = page.locator(".obw-lang-continue");
        await expect(continueBtn).toBeEnabled();
        await continueBtn.click();

        // Verify login screen opened immediately in English
        await expect(page.locator(".obw-lang-grid")).not.toBeVisible({
            timeout: 10000,
        });
        await expect(page.locator(".auth-card__title")).toHaveText(
            "Welcome back",
        );
        await expect(page.locator(".auth-card__subtitle")).toHaveText(
            "Sign in to continue to Krisiveda",
        );

        const savedLang = await page.evaluate(() =>
            localStorage.getItem("krisiveda-lang"),
        );
        expect(savedLang).toBe("en");
    });
});

// Temporary: applies the new voice-error translation keys (str_replace kept
// timing out on this large file). Deleted after use.
import fs from "node:fs";

const path = "src/data/translations.js";
let src = fs.readFileSync(path, "utf8");

const edits = [
    {
        old: '            voiceNetwork: "Speech recognition needs an internet connection. Please type your question instead.",',
        add: [
            '            voiceOffline: "You are offline, so the browser cannot turn speech into text. Reconnect and try again, or type your question.",',
            '            voiceServiceUnavailable: "The browser\'s speech service is not responding. This is not a microphone problem — try again, or type your question.",',
            '            voiceLangUnsupported: "This browser cannot recognise the selected spoken language. Pick another language or type your question.",',
            '            voiceRetry: "Try again",',
            '            voiceTypeInstead: "Type instead",',
        ],
    },
    {
        old: '            voiceNetwork: "কণ্ঠ শনাক্তকরণের জন্য ইন্টারনেট দরকার। অনুগ্রহ করে প্রশ্ন টাইপ করুন।",',
        add: [
            '            voiceOffline: "আপনি অফলাইনে আছেন, তাই ব্রাউজার কথা লেখায় বদলাতে পারছে না। ইন্টারনেট চালু করে আবার চেষ্টা করুন অথবা প্রশ্ন টাইপ করুন।",',
            '            voiceServiceUnavailable: "ব্রাউজারের ভয়েস পরিষেবা সাড়া দিচ্ছে না। এটি মাইক্রোফোনের সমস্যা নয় — আবার চেষ্টা করুন বা প্রশ্ন টাইপ করুন।",',
            '            voiceLangUnsupported: "এই ব্রাউজার নির্বাচিত ভাষা চিনতে পারে না। অন্য ভাষা বেছে নিন অথবা প্রশ্ন টাইপ করুন।",',
            '            voiceRetry: "আবার চেষ্টা করুন",',
            '            voiceTypeInstead: "টাইপ করুন",',
        ],
    },
    {
        old: '            voiceNetwork: "वॉइस पहचान के लिए इंटरनेट चाहिए। कृपया सवाल टाइप करें।",',
        add: [
            '            voiceOffline: "आप ऑफ़लाइन हैं, इसलिए ब्राउज़र बोली को टेक्स्ट में नहीं बदल सकता। इंटरनेट जोड़कर फिर कोशिश करें या सवाल टाइप करें।",',
            '            voiceServiceUnavailable: "ब्राउज़र की वॉइस सेवा जवाब नहीं दे रही। यह माइक्रोफ़ोन की गड़बड़ी नहीं है — फिर कोशिश करें या सवाल टाइप करें।",',
            '            voiceLangUnsupported: "यह ब्राउज़र चुनी हुई बोली को नहीं पहचान सकता। दूसरी भाषा चुनें या सवाल टाइप करें।",',
            '            voiceRetry: "फिर कोशिश करें",',
            '            voiceTypeInstead: "टाइप करें",',
        ],
    },
    {
        old: '            voiceNetwork: "వాయిస్ గుర్తింపుకు ఇంటర్నెట్ అవసరం. దయచేసి ప్రశ్న టైప్ చేయండి.",',
        add: [
            '            voiceOffline: "మీరు ఆఫ్‌లైన్‌లో ఉన్నారు, కాబట్టి బ్రౌజర్ మాటలను టెక్స్ట్‌గా మార్చలేదు. ఇంటర్నెట్ కలిపి మళ్లీ ప్రయత్నించండి లేదా ప్రశ్న టైప్ చేయండి.",',
            '            voiceServiceUnavailable: "బ్రౌజర్ వాయిస్ సేవ స్పందించడం లేదు. ఇది మైక్రోఫోన్ సమస్య కాదు — మళ్లీ ప్రయత్నించండి లేదా ప్రశ్న టైప్ చేయండి.",',
            '            voiceLangUnsupported: "ఈ బ్రౌజర్ ఎంచుకున్న భాషను గుర్తించలేదు. వేరే భాష ఎంచుకోండి లేదా ప్రశ్న టైప్ చేయండి.",',
            '            voiceRetry: "మళ్లీ ప్రయత్నించండి",',
            '            voiceTypeInstead: "టైప్ చేయండి",',
        ],
    },
    {
        old: '            voiceNetwork: "குரல் அடையாளத்திற்கு இணையம் தேவை. தயவுசெய்து கேள்வியைத் தட்டச்சு செய்யுங்கள்.",',
        add: [
            '            voiceOffline: "நீங்கள் ஆஃப்லைனில் உள்ளீர்கள், எனவே உலாவியால் பேச்சை எழுத்தாக்க முடியவில்லை. இணையத்தை இணைத்து மீண்டும் முயற்சிக்கவும் அல்லது கேள்வியைத் தட்டச்சு செய்யவும்.",',
            '            voiceServiceUnavailable: "உலாவியின் குரல் சேவை பதிலளிக்கவில்லை. இது மைக்ரோஃபோன் பிரச்சினை அல்ல — மீண்டும் முயற்சிக்கவும் அல்லது கேள்வியைத் தட்டச்சு செய்யவும்.",',
            '            voiceLangUnsupported: "இந்த உலாவியால் தேர்ந்தெடுத்த மொழியை அடையாளம் காண முடியவில்லை. வேறு மொழியைத் தேர்ந்தெடுக்கவும் அல்லது கேள்வியைத் தட்டச்சு செய்யவும்.",',
            '            voiceRetry: "மீண்டும் முயற்சிக்கவும்",',
            '            voiceTypeInstead: "தட்டச்சு செய்யவும்",',
        ],
    },
];

for (const { old, add } of edits) {
    if (!src.includes(old)) {
        console.log(`SKIP (already applied or missing): ${old.slice(0, 60)}`);
        continue;
    }
    src = src.replace(old, add.join("\n"));
    console.log(`APPLIED: ${old.slice(0, 60)}`);
}

/* Clearer wording for the no-speech case, which is now also shown after a
   stopped session (the old "yet" implied it was still listening). */
const noSpeech = [
    "No speech was detected. Speak clearly into the microphone and try again.",
    "কোনো কথা শনাক্ত হয়নি। মাইক্রোফোনে স্পষ্টভাবে বলুন এবং আবার চেষ্টা করুন।",
    "कोई आवाज़ नहीं सुनाई दी। माइक्रोफ़ोन में साफ़ बोलें और फिर कोशिश करें।",
    "మాటలు గుర్తించబడలేదు. మైక్రోఫోన్‌లో స్పష్టంగా మాట్లాడి మళ్లీ ప్రయత్నించండి.",
    "பேச்சு எதுவும் கண்டறியப்படவில்லை. மைக்ரோஃபோனில் தெளிவாகப் பேசி மீண்டும் முயற்சிக்கவும்.",
];
let noSpeechIndex = 0;
src = src.replace(
    /^(\s*)voiceNoSpeech: ".*",$/gm,
    (match, indent) => {
        const next = noSpeech[noSpeechIndex];
        if (!next) return match;
        noSpeechIndex += 1;
        return `${indent}voiceNoSpeech: "${next}",`;
    },
);
console.log(`noSpeech replaced=${noSpeechIndex}`);

fs.writeFileSync(path, src);
console.log(
    `voiceNetwork=${(src.match(/voiceNetwork:/g) || []).length} voiceServiceUnavailable=${(src.match(/voiceServiceUnavailable:/g) || []).length} voiceRetry=${(src.match(/voiceRetry:/g) || []).length}`,
);

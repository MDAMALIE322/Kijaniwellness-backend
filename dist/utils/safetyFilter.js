"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safetyFilter = safetyFilter;
const MEDICAL_TERMS = [
    'diagnose', 'diagnosis', 'treat', 'treatment', 'cure', 'cures',
    'disease', 'disorder', 'symptom', 'symptoms', 'cancer', 'diabetes',
    'will harm you', 'causes disease', 'toxic', 'poison',
    'medication', 'prescription', 'mental illness',
];
const CRISIS_TERMS = [
    'want to die', 'kill myself', 'end my life', 'suicide',
    'suicidal', 'self-harm', 'hurt myself',
];
const CRISIS_RESPONSE = `I'm not able to help with this through the app. If you are having thoughts of harming yourself, please reach out for immediate support. Contact a crisis line in your country or go to your nearest emergency room. You are not alone.`;
const MEDICAL_RESPONSE = `I'm not able to assess medical symptoms or conditions. Please consult a qualified healthcare professional for guidance on health concerns.`;
function safetyFilter(text) {
    const lower = text.toLowerCase();
    for (const term of CRISIS_TERMS) {
        if (lower.includes(term)) {
            return { blocked: true, isCrisis: true, safeText: CRISIS_RESPONSE };
        }
    }
    for (const term of MEDICAL_TERMS) {
        if (lower.includes(term)) {
            return { blocked: true, isCrisis: false, safeText: MEDICAL_RESPONSE };
        }
    }
    return { blocked: false, isCrisis: false, safeText: text };
}

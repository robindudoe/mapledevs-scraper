const fs = require('fs-extra');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Configuration
const STATE_PATH = path.join(__dirname, 'state.json');

/**
 * Update the global swarm state
 */
async function updateState(newState) {
    const statePath = path.join(__dirname, 'state.json');
    const stateJsPath = path.join(__dirname, 'state.js');
    
    let currentState = {};
    if (await fs.pathExists(statePath)) {
        currentState = await fs.readJson(statePath);
    }
    
    const mergedState = { ...currentState, ...newState };
    await fs.writeJson(statePath, mergedState, { spaces: 2 });
    
    // Also write as a JS file for local browser compatibility (bypasses CORS)
    const jsContent = `window.SWARM_STATE = ${JSON.stringify(mergedState, null, 2)};`;
    await fs.writeFile(stateJsPath, jsContent);
}

/**
 * Updates a specific agent's status and last action
 */
async function updateAgent(id, status, lastAction) {
    const state = await fs.readJson(STATE_PATH);
    if (state.agents[id]) {
        state.agents[id].status = status;
        state.agents[id].last_action = lastAction;
        state.agents[id].last_run = new Date().toISOString();
        await fs.writeJson(STATE_PATH, state, { spaces: 2 });
    }
}

/**
 * Initialize Gemini
 */
function getGemini(modelName = 'gemini-1.5-flash') {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('MISSING_API_KEY: Please set GOOGLE_API_KEY in your .env file.');
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: modelName });
}

/**
 * Generic AI call with retry and fallback logic
 */
async function askAI(agentName, prompt, model = 'gemini-2.5-flash') {
    const modelsToTry = [model, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'];
    let lastError;

    for (const modelName of modelsToTry) {
        try {
            console.log(`[${agentName}] Attempting with model: ${modelName}`);
            const genModel = getGemini(modelName);
            const result = await genModel.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            lastError = error;
            if (error.message.includes('API key expired') || error.message.includes('API_KEY_INVALID')) {
                throw error; // Don't bother retrying if the key itself is the problem
            }
            console.warn(`[${agentName}] Model ${modelName} failed, trying next...`);
        }
    }
    
    console.error(`[${agentName}] All models failed.`);
    throw lastError;
}

/**
 * Initialize Google Sheets API
 */
async function getSheets() {
    const { google } = require('googleapis');
    const rawCreds = process.env.GOOGLE_INDEXING_KEY || process.env.GOOGLE_PRIVATE_KEY;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    if (!rawCreds) throw new Error('MISSING_GOOGLE_CREDS: Please set GOOGLE_PRIVATE_KEY.');

    let credentials;
    try {
        credentials = JSON.parse(rawCreds.trim());
    } catch (e) {
        try {
            credentials = JSON.parse(Buffer.from(rawCreds.trim(), 'base64').toString('utf-8'));
        } catch (e2) {
            const privateKey = rawCreds.includes('BEGIN PRIVATE KEY')
                ? rawCreds.replace(/\\n/g, '\n')
                : Buffer.from(rawCreds.trim(), 'base64').toString('utf-8');
            credentials = {
                client_email: clientEmail,
                private_key: privateKey,
            };
        }
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
}

module.exports = {
    updateState,
    updateAgent,
    askAI,
    getSheets,
    STATE_PATH
};

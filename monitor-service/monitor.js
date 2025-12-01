const axios = require("axios");

const CRITICAL_URL = process.env.CRITICAL_URL || "http://localhost:8080/status";
const ADMIN_RESTART_URL = process.env.ADMIN_RESTART_URL || "http://localhost:5001/restart_service";
const TELEGRAM_PROXY_BASE_URL = process.env.TELEGRAM_PROXY_BASE_URL || "http://localhost:8100";
const CHANNEL_ID = process.env.CHANNEL_ID || "";
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "5") * 1000;
const LATENCY_THRESHOLD_SEC = parseFloat(process.env.LATENCY_THRESHOLD_SEC || "0.5");

async function sendTelegram(text) {
    if (!CHANNEL_ID) {
        console.log(`TELEGRAM: ${text} (skipped - CHANNEL_ID not set)`);
        return;
    }

    try {
        await axios.post(
            `${TELEGRAM_PROXY_BASE_URL}/send-message`,
            {
                channel_name: CHANNEL_ID,
                message: text,
            },
            { timeout: 3000 }
        );
        console.log(`TELEGRAM: message "${text}" sent on [${CHANNEL_ID}]`);
    } catch (error) {
        console.error("Telegram send failed");
    }
}
/**
 * Sends a POST request to admin-service to trigger critical-service restart
 */
async function restartService() {
    try {
        console.log("Requesting admin service to restart critical service...");
        await axios.post(ADMIN_RESTART_URL, { service: "critical" }, { timeout: 3000 });
        console.log("Admin service restart request completed");
    } catch (error) {
        console.error("Admin service restart request failed:", error.message);
    }
}

/**
 * Sends a GET request to critical-service to check its status.
 * Based on the response and latency it might trigger the critical-service restart.
 */
async function checkStatus() {
    let alertMessage = null;

    try {
        const start = Date.now();
        const response = await axios.get(CRITICAL_URL, { timeout: 2000 });
        const latency = (Date.now() - start) / 1000;
        const body = response.data;
        const memory = body.memory;

        //EXERCISE 1: SHOW THE MEMORY IN THE LOG AND ADD RECOVER CONDITION ON MEMORY
        console.log(`Status: ${response.status}, Latency: ${latency.toFixed(3)}s`);

        //EXERCISE 2: LET THE MONITOR ACCEPT 1s LATENCY
        if (response.status !== 200 || latency > LATENCY_THRESHOLD_SEC) {
            //ASSIGMENT: CREATE A MEMORY_THRESHOLD_KB AND SET IT TO 600 THEN SHOW IT IN THE ALERT MESSAGE IN CASE OF MEMORY ERROR
            alertMessage = `ALERT: status ${response.status} latency ${latency.toFixed(2)}s`;
        }
    } catch (error) {
        alertMessage = `ALERT: service unreachable (${error.message})`;
    }

    if (alertMessage) {
        console.error(alertMessage);
        await sendTelegram(alertMessage);

        await restartService();
    }
}

console.log("Monitor Service started");
console.log(`Polling ${CRITICAL_URL} every ${POLL_INTERVAL / 1000}s`);
console.log(`Latency threshold: ${LATENCY_THRESHOLD_SEC}s`);

setInterval(checkStatus, POLL_INTERVAL);

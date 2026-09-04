"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const healthPath = path.join(projectRoot, "data", "health", "latest.json");
const configPath = path.join(projectRoot, "data", "system", "local-server.json");
const port = Number(process.env.ANTHONY_OS_PORT || 8787);

const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
};

function loadOrCreateConfig() {
    if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }

    const config = {
        apiKey: crypto.randomBytes(24).toString("hex")
    };

    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, {
        mode: 0o600
    });

    return config;
}

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    response.end(`${JSON.stringify(payload)}\n`);
}

function validNumber(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validateHealthUpdate(update) {
    if (!update || typeof update !== "object" || Array.isArray(update)) {
        return "Health update must be a JSON object.";
    }

    if (update.steps !== undefined && !validNumber(update.steps)) {
        return "steps must be a number greater than or equal to zero.";
    }

    if (update.activeCalories !== undefined && !validNumber(update.activeCalories)) {
        return "activeCalories must be a number greater than or equal to zero.";
    }

    if (update.sleep?.totalHours !== undefined &&
        update.sleep.totalHours !== null &&
        !validNumber(update.sleep.totalHours)) {
        return "sleep.totalHours must be a number greater than or equal to zero.";
    }

    return null;
}

function mergeHealthUpdate(current, update) {
    const activityDate = update.activityDate || update.date || current.activity?.date || null;
    const sleep = update.sleep
        ? {
            ...current.sleep,
            ...update.sleep,
            stages: {
                ...current.sleep?.stages,
                ...update.sleep.stages
            }
        }
        : current.sleep;

    return {
        source: "apple-health",
        lastUpdated: update.capturedAt || new Date().toISOString(),
        sleep,
        activity: {
            date: activityDate,
            steps: update.steps ?? current.activity?.steps ?? 0,
            activeCalories: update.activeCalories ?? current.activity?.activeCalories ?? 0
        }
    };
}

function receiveHealth(request, response, config) {
    if (request.headers["x-anthony-key"] !== config.apiKey) {
        sendJson(response, 401, { ok: false, error: "Invalid Anthony OS key." });
        return;
    }

    let body = "";

    request.on("data", chunk => {
        body += chunk;

        if (body.length > 1024 * 1024) {
            request.destroy();
        }
    });

    request.on("end", () => {
        try {
            const update = JSON.parse(body);
            const validationError = validateHealthUpdate(update);

            if (validationError) {
                sendJson(response, 400, { ok: false, error: validationError });
                return;
            }

            const current = JSON.parse(fs.readFileSync(healthPath, "utf8"));
            const health = mergeHealthUpdate(current, update);

            fs.writeFileSync(healthPath, `${JSON.stringify(health, null, 2)}\n`);
            sendJson(response, 200, { ok: true, lastUpdated: health.lastUpdated });
        } catch (error) {
            sendJson(response, 400, { ok: false, error: error.message });
        }
    });
}

function serveFile(request, response) {
    const requestUrl = new URL(request.url, "http://localhost");
    let requestedPath = requestUrl.pathname === "/"
        ? "/dashboard/web/index.html"
        : requestUrl.pathname;

    if (requestedPath.endsWith("/")) {
        requestedPath += "index.html";
    }

    const filePath = path.resolve(projectRoot, `.${decodeURIComponent(requestedPath)}`);

    if (!filePath.startsWith(`${projectRoot}${path.sep}`)) {
        sendJson(response, 403, { ok: false, error: "Forbidden." });
        return;
    }

    fs.readFile(filePath, (error, file) => {
        if (error) {
            sendJson(response, error.code === "ENOENT" ? 404 : 500, {
                ok: false,
                error: error.code === "ENOENT" ? "Not found." : "Could not read file."
            });
            return;
        }

        response.writeHead(200, {
            "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
            "Cache-Control": "no-store"
        });
        response.end(file);
    });
}

const config = loadOrCreateConfig();
const server = http.createServer((request, response) => {
    if (request.method === "POST" && request.url === "/api/health") {
        receiveHealth(request, response, config);
        return;
    }

    if (request.method === "GET") {
        serveFile(request, response);
        return;
    }

    sendJson(response, 405, { ok: false, error: "Method not allowed." });
});

server.listen(port, "0.0.0.0", () => {
    console.log(`Anthony OS is running on port ${port}.`);
    console.log(`Dashboard: http://localhost:${port}/dashboard/web/`);
    console.log(`Health receiver: POST http://localhost:${port}/api/health`);
    console.log(`Private pairing key: ${config.apiKey}`);
});

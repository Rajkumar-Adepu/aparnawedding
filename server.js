const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const tls = require("tls");

const root = __dirname;
const dataDir = path.join(root, "data");
const rsvpFile = path.join(dataDir, "rsvps.json");
const rsvpCsvFile = path.join(dataDir, "rsvps.csv");
const port = Number(process.env.PORT || 4177);
const notificationEmail = process.env.RSVP_NOTIFY_EMAIL || "gtest5833@gmail.com";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

async function readRsvps() {
  try {
    const contents = await fs.readFile(rsvpFile, "utf8");
    const data = JSON.parse(contents);
    return Array.isArray(data.rsvps) ? data.rsvps : [];
  } catch (error) {
    return [];
  }
}

async function writeRsvps(rsvps) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(rsvpFile, `${JSON.stringify({ rsvps }, null, 2)}\n`);
  await fs.writeFile(rsvpCsvFile, buildRsvpCsv(rsvps));
}

function escapeCsv(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}

function buildRsvpCsv(rsvps) {
  const rows = [
    ["Name", "Email", "Attendance", "Message", "Submitted At"],
    ...rsvps.map((entry) => [
      entry.name,
      entry.email,
      entry.attendance === "yes" ? "Joyfully accepting" : "Sending blessings from afar",
      entry.message,
      entry.createdAt,
    ]),
  ];

  return `${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`;
}

function jsonResponse(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function readSmtpResponse(socket) {
  return new Promise((resolve, reject) => {
    let response = "";
    const onData = (chunk) => {
      response += chunk.toString("utf8");
      const lines = response.split(/\r?\n/).filter(Boolean);
      if (lines.some((line) => /^\d{3} /.test(line))) {
        socket.off("data", onData);
        socket.off("error", onError);
        resolve(response);
      }
    };
    const onError = (error) => {
      socket.off("data", onData);
      reject(error);
    };

    socket.on("data", onData);
    socket.once("error", onError);
  });
}

async function sendSmtpCommand(socket, command, expectedCode) {
  socket.write(`${command}\r\n`);
  const response = await readSmtpResponse(socket);
  if (!response.startsWith(expectedCode)) {
    throw new Error(`SMTP command failed: ${response}`);
  }
}

async function notifyRsvp(entry) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const portNumber = Number(process.env.SMTP_PORT || 465);

  if (!host || !user || !pass || !from || !notificationEmail) {
    return;
  }

  const socket = tls.connect(portNumber, host, { servername: host });
  await new Promise((resolve, reject) => {
    socket.once("secureConnect", resolve);
    socket.once("error", reject);
  });

  try {
    const greeting = await readSmtpResponse(socket);
    if (!greeting.startsWith("220")) throw new Error(`SMTP greeting failed: ${greeting}`);

    await sendSmtpCommand(socket, "EHLO localhost", "250");
    await sendSmtpCommand(socket, "AUTH LOGIN", "334");
    await sendSmtpCommand(socket, Buffer.from(user).toString("base64"), "334");
    await sendSmtpCommand(socket, Buffer.from(pass).toString("base64"), "235");
    await sendSmtpCommand(socket, `MAIL FROM:<${from}>`, "250");
    await sendSmtpCommand(socket, `RCPT TO:<${notificationEmail}>`, "250");
    await sendSmtpCommand(socket, "DATA", "354");

    const body = [
      `New RSVP for Adepu Aparna & Gaddamidi Aravind`,
      "",
      `Name: ${entry.name}`,
      `Email: ${entry.email}`,
      `Attendance: ${entry.attendance === "yes" ? "Joyfully accepting" : "Sending blessings from afar"}`,
      `Message: ${entry.message || "-"}`,
      `Submitted At: ${entry.createdAt}`,
    ].join("\r\n");

    const message = [
      `From: ${from}`,
      `To: ${notificationEmail}`,
      `Subject: New wedding RSVP from ${entry.name}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      body,
    ]
      .join("\r\n")
      .replace(/\r\n\./g, "\r\n..");

    await sendSmtpCommand(socket, `${message}\r\n.`, "250");
    await sendSmtpCommand(socket, "QUIT", "221");
  } finally {
    socket.end();
  }
}

async function handleRsvpApi(request, response) {
  if (request.method === "GET") {
    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const adminToken = process.env.RSVP_ADMIN_TOKEN;

    if (!adminToken || requestUrl.searchParams.get("token") !== adminToken) {
      jsonResponse(response, 403, { error: "RSVP list is private" });
      return;
    }

    jsonResponse(response, 200, { rsvps: await readRsvps() });
    return;
  }

  if (request.method !== "POST") {
    jsonResponse(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const payload = JSON.parse(await readRequestBody(request));
    const entry = {
      name: cleanText(payload.name, 80),
      email: cleanText(payload.email, 120),
      attendance: payload.attendance === "no" ? "no" : "yes",
      message: cleanText(payload.message, 500),
      createdAt: payload.createdAt || new Date().toISOString(),
    };

    if (!entry.name || !entry.email) {
      jsonResponse(response, 400, { error: "Name and email are required" });
      return;
    }

    const rsvps = await readRsvps();
    rsvps.push(entry);
    await writeRsvps(rsvps);
    notifyRsvp(entry).catch((error) => {
      console.warn(`RSVP email notification failed: ${error.message}`);
    });
    jsonResponse(response, 200, { saved: true });
  } catch (error) {
    jsonResponse(response, 400, { error: "Invalid RSVP" });
  }
}

async function handleRsvpCsv(request, response) {
  if (request.method !== "GET") {
    jsonResponse(response, 405, { error: "Method not allowed" });
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const adminToken = process.env.RSVP_ADMIN_TOKEN;

  if (!adminToken || requestUrl.searchParams.get("token") !== adminToken) {
    jsonResponse(response, 403, { error: "RSVP spreadsheet is private" });
    return;
  }

  const rsvps = await readRsvps();
  response.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Disposition": 'attachment; filename="aparna-aravind-rsvps.csv"',
  });
  response.end(buildRsvpCsv(rsvps));
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const requestedPath = requestUrl.pathname === "/" ? "/index.html" : decodeURIComponent(requestUrl.pathname);
  const filePath = path.resolve(root, `.${requestedPath}`);

  if (!filePath.startsWith(root) || filePath.startsWith(dataDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(file);
  } catch (error) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  if (request.url?.startsWith("/api/rsvps.csv")) {
    await handleRsvpCsv(request, response);
    return;
  }

  if (request.url?.startsWith("/api/rsvps")) {
    await handleRsvpApi(request, response);
    return;
  }

  await serveStatic(request, response);
});

server.listen(port, () => {
  console.log(`Wedding invitation preview running at http://localhost:${port}/`);
});

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { google } from 'googleapis';
import { createCanvas } from 'canvas';
import * as wallpaper from 'wallpaper';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

// For __dirname support in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

const lineHeight = 24; // Height of event lines

// Load client secrets
fs.readFile(CREDENTIALS_PATH, (err, content) => {
  if (err) return console.error('Error loading credentials:', err);
  authorize(JSON.parse(content), updateWallpaper);
});

function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
  });
  console.log('Authorize this app by visiting this URL:', authUrl);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      callback(oAuth2Client);
    });
  });
}

async function updateWallpaper(auth) {
  const calendar = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(now.getDate() + 7);

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: sevenDaysLater.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = res.data.items || [];

  // Group events by date
  const groupedEvents = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    const key = date.toISOString().split('T')[0]; // YYYY-MM-DD
    groupedEvents[key] = [];
  }

  for (const event of events) {
    const start = event.start.dateTime || event.start.date;
    const dateKey = new Date(start).toISOString().split('T')[0];
    if (groupedEvents[dateKey]) {
      groupedEvents[dateKey].push(event);
    }
  }

  // Canvas setup
  const width = 1920;
  const height = 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, width, height);

  const padding = 20;
  const columnWidth = (width - padding * 2) / 7;
  const headerHeight = 80;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Sans';

  // Draw each day
  Object.entries(groupedEvents).forEach(([dateKey, events], i) => {
    const x = padding + i * columnWidth;
    const y = padding;

    // Header: day name + date
    const date = new Date(dateKey);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    ctx.fillText(`${dayName} ${dateStr}`, x, y + 30);

    // Events
    ctx.font = '20px Sans';
    let eventY = y + headerHeight;
    const maxEventWidth = columnWidth - padding; // Max width for events

    events.forEach((event) => {
      const start = event.start.dateTime || event.start.date;
      const time = event.start.dateTime
        ? new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'All day';

      const summary = event.summary || '(No Title)';
      const line = `${time} - ${summary}`;

      if (eventY < height - 40) {
        eventY = wrapText(ctx, line, x, eventY, maxEventWidth, lineHeight);
      }
    });
  });

  const imagePath = path.join(__dirname, 'calendar-wallpaper.png');
  const out = fs.createWriteStream(imagePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  out.on('finish', async () => {
    try {
      await wallpaper.set(imagePath);
      console.log('Wallpaper updated!');
    } catch (err) {
      console.error('Failed to set wallpaper using `wallpaper` package. Trying fallback method...');
      fallbackSetWallpaperWindows(imagePath);
    }
  });
}

// Fallback: Use Windows PowerShell to set wallpaper
function fallbackSetWallpaperWindows(imagePath) {
  const command = `powershell -command "(Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")]public static extern bool SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);' -Name 'Win32' -Namespace 'Wallpaper' -PassThru)::SystemParametersInfo(20, 0, '${imagePath.replace(/\\/g, '/')}', 3)"`;

  exec(command, (err) => {
    if (err) {
      console.error('Fallback wallpaper set failed:', err);
    } else {
      console.log('Wallpaper set via PowerShell fallback!');
    }
  });
}

// Wrap text if the string's too long
function wrapText(context, text, x, y, maxWidth, lineHeight){
  const words = text.split(' ');
  let line = '';
  let testLine = '';
  let metrics; // width
  let testWidth;

  for (let n = 0; n < words.length; n++){
    testLine = line + words[n] + ' ';
    metrics = context.measureText(testLine);
    testWidth = metrics.width;

    if(testWidth > maxWidth && n > 0) {
      context.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, y);
  return y + lineHeight;
}
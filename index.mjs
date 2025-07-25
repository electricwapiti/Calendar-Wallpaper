import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { google } from 'googleapis';
import { createCanvas } from 'canvas';
import * as wallpaper from 'wallpaper';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { renderWeeklyCalendar } from './calendarRenderer.mjs';


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
  const imagePath = path.join(__dirname, 'calendar-wallpaper.png');

  await renderWeeklyCalendar(events, imagePath);

  try {
    await wallpaper.set(imagePath);
    console.log('Walpaper updated!');
  } catch (err) {
    console.error('Failed to set wallpaper using `wallpaper` package. Trying fallback method...');
    fallbackSetWallpaperWindows(imagePath);
  }
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
import { createCanvas, registerFont } from "canvas";
import fs from "fs";

export function renderWeeklyCalendar(events, outputPath, options = {}) {
  const width = options.width || 1920;
  const height = options.height || 1080;
  const margin = 40;
  const headerHeight = 60;
  const columnSpacing = 10;
  const columnWidth = (width - margin * 2 - columnSpacing * 6) / 7;
  const rowPadding = 30;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, 0, width, height);

  // Draw grid
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 2;

  for (let i = 0; i <= 7; i++) {
    const x =
      margin +
      i * (columnWidth + columnSpacing) -
      (i === 0 ? 0 : columnSpacing);
    ctx.beginPath();
    ctx.moveTo(x, margin);
    ctx.lineTo(x, height - margin);
    ctx.stroke();
  }

  // Get 7 consecutive days starting from today
  const today = new Date();
  const grouped = groupEventsByDay(events, today);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 20px Sans";

  // Render each column
  Object.entries(grouped).forEach(([dateStr, events], i) => {
    const x = margin + i * (columnWidth + columnSpacing);
    const y = margin;
    const [year, month, day] = dateStr.split("-");
    const chicagoDate = new Date(
      new Date(`${month}/${day}/${year}`).toLocaleString("en-US", { timeZone: "America/Chicago" })
    );

    const title = chicagoDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "numeric",
      day: "numeric",
    });
    ctx.fillText(title, x + 10, y + 30);

    // Events in the column
    let yOffset = y + headerHeight;

    events.forEach((event) => {
      const start = event.start.dateTime || event.start.date;
      const time = event.start.dateTime ? new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All day';
      const summary = event.summary || "(No Title)";
      wrapText(ctx, `${time} - ${summary}`, x + 10, yOffset, columnWidth - 20, 20);
      yOffset += 80;
    });
  });

  // Save image
  const out = fs.createWriteStream(outputPath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
}

function groupEventsByDay(events, baseDate) {
  const grouped = {};

  // Helper to get yyyy-mm-dd in Chicago local time
  const getChicagoDateKey = (date) => {
    const chicagoDate = new Date(date).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const [month, day, year] = chicagoDate.split("/");
    return `${year}-${month}-${day}`;
  };

  for (let i = 0; i < 7; i++) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + i);
    const key = getChicagoDateKey(date);
    grouped[key] = [];
  }

  events.forEach(event => {
    const start = event.start.dateTime || event.start.date;
    const key = getChicagoDateKey(start);
    if (grouped[key]) grouped[key].push(event);
  });

  return grouped;
}

// Wrap text if the string's too long
function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let testLine = "";
  let metrics; // width
  let testWidth;

  for (let n = 0; n < words.length; n++) {
    testLine = line + words[n] + " ";
    metrics = context.measureText(testLine);
    testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, y);
  return y + lineHeight;
}

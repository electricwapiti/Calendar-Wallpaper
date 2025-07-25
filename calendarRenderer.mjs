import { createCanvas, registerFont } from 'canvas';
import fs from 'fs';

export function renderWeeklyCalendar(events, outputPath, options = {}) {
    const width = options.width || 1920;
    const height = options.height || 1080;
    const margin = 40;
    const headerHeight = 60;
    const columnSpacing = 10;
    const columnWidth = (width - margin * 2 - columnSpacing * 6) / 7;
    const rowPadding = 30;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0,0, width, height);

    // Draw grid
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;

    for (let y = margin + headerHeight; y < height - margin; y += 100) {
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(width - margin, y);
        ctx.stroke();
    }

    // Get 7 consecutive days starting from today
    const today = new Date();
    const grouped = groupEventsByDay(events, today);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Sans';

    // Render each column
    Object.entries(grouped).forEach(([dateStr, events], i) => {
        const x = margin + i * (columnWidth + columnSpacing);
        const y = margin;
        const date = new Date(dateStr);
        const title = `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${date.getMonth() + 1}/${date.getDate()}`;
        ctx.fillText(title, x + 10, y + 30);

        // Events in the column
        ctx.font = '16px Sans'
        let yOffset = y + headerHeight;

        events.forEach((event) => {
            const start = event.start.dateTime || event.start.date;
            const time = event.start.dateTime ? new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All day';
            const summary = event.summary || '(No Title)';
            wrapText(ctx, `${time} - ${summary}`, x + 10, yOffset, columnWidth - 20, 20);
            yOffset += 40;
        });
    });

    // Save image
    const out = fs.createWriteStream(outputPath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
}

function groupEventsByDay(events, baseDate) {
    const grouped = {};
    for (let i = 0; i < 7; i++) {
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() + i);
        const key = date.toISOString().split('T')[0];
        grouped[key] = [];
    }

    events.forEach(event => {
        const start = event.start.dateTime || event.start.date;
        const dateKey = new Date(start).toISOString().split('T')[0];
        if (grouped[dateKey]) grouped[dateKey].push(event);
    });

    return grouped;
}

// Wrap text if the string's too long
function wrapText(context, text, x, y, maxWidth, lineHeight) {
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
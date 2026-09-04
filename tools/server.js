'use strict';
// Сервер для игры вдвоём в локальной сети: node tools/server.js [порт]
//
// Делает две вещи:
//   1. раздаёт файлы игры по HTTP, чтобы второй компьютер мог её открыть;
//   2. передаёт сообщения между двумя браузерами по WebSocket.
//
// Зависимостей нет: рукопожатие и кадры WebSocket разобраны вручную, всё нужное
// есть во встроенных модулях. Одиночная игра сервером не пользуется и по-прежнему
// открывается двойным кликом по index.html.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const root = path.join(__dirname, '..');
const port = Number(process.argv[2]) || 8123;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// ---------- HTTP ----------
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.join(root, rel);

  // Наружу отдаём только то, что лежит внутри папки игры.
  if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

// ---------- WebSocket ----------
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const clients = new Set();

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (req.headers.upgrade !== 'websocket' || !key) { socket.destroy(); return; }

  const accept = crypto.createHash('sha1').update(key + WS_MAGIC).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  socket.setNoDelay(true);   // на локальной сети важнее задержка, чем объём

  const client = { socket, role: clients.size === 0 ? 'host' : 'guest' };
  clients.add(client);
  console.log(`+ подключился ${client.role} (${req.socket.remoteAddress}), всего ${clients.size}`);
  send(socket, JSON.stringify({ t: 'hello', role: client.role }));
  broadcastPresence();

  let buf = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const frame = readFrame(buf);
      if (!frame) break;
      buf = buf.subarray(frame.size);
      if (frame.opcode === 0x8) { socket.end(); return; }        // close
      if (frame.opcode === 0x9) { send(socket, frame.payload, 0xA); continue; }  // ping → pong
      if (frame.opcode !== 0x1 && frame.opcode !== 0x0) continue;
      // Всё, что пришло от одного, уходит другому: сервер в игру не вникает.
      for (const c of clients) if (c !== client) send(c.socket, frame.payload);
    }
  });

  const drop = () => {
    if (!clients.delete(client)) return;
    console.log(`- отключился ${client.role}, осталось ${clients.size}`);
    broadcastPresence();
  };
  socket.on('close', drop);
  socket.on('error', drop);
});

function broadcastPresence() {
  const msg = JSON.stringify({ t: 'presence', count: clients.size });
  for (const c of clients) send(c.socket, msg);
}

// Разбор входящего кадра. Возвращает null, пока кадр не пришёл целиком.
function readFrame(b) {
  if (b.length < 2) return null;
  const opcode = b[0] & 0x0f;
  const masked = (b[1] & 0x80) !== 0;
  let len = b[1] & 0x7f;
  let off = 2;
  if (len === 126) { if (b.length < off + 2) return null; len = b.readUInt16BE(off); off += 2; }
  else if (len === 127) { if (b.length < off + 8) return null; len = Number(b.readBigUInt64BE(off)); off += 8; }
  let mask = null;
  if (masked) { if (b.length < off + 4) return null; mask = b.subarray(off, off + 4); off += 4; }
  if (b.length < off + len) return null;

  const payload = Buffer.from(b.subarray(off, off + len));
  // Браузер обязан маскировать то, что шлёт серверу, — снимаем маску.
  if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
  return { opcode, payload: payload.toString('utf8'), size: off + len };
}

// Отправка кадра. От сервера к клиенту маска не нужна.
function send(socket, data, opcode = 0x1) {
  if (socket.destroyed) return;
  const body = Buffer.from(data, 'utf8');
  let head;
  if (body.length < 126) {
    head = Buffer.from([0x80 | opcode, body.length]);
  } else if (body.length < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(body.length, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(body.length), 2);
  }
  socket.write(Buffer.concat([head, body]));
}

// ---------- Запуск ----------
function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) if (n.family === 'IPv4' && !n.internal) out.push(n.address);
  }
  return out;
}

server.listen(port, '0.0.0.0', () => {
  console.log(`\nТени Подгорья — сервер запущен на порту ${port}\n`);
  console.log(`  этот компьютер:   http://localhost:${port}`);
  for (const a of lanAddresses()) console.log(`  из локальной сети: http://${a}:${port}`);
  console.log('\nОстановить — Ctrl+C\n');
});

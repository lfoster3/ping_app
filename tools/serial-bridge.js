#!/usr/bin/env node
/**
 * Serial → WebSocket bridge for the ESP32 Ping sensor.
 *
 * Reads JSON telemetry from the ESP32's USB serial port and relays it
 * to any connected WebSocket client. The React Native app connects to
 * ws://localhost:<port> to receive live sensor data.
 *
 * Usage:
 *   node tools/serial-bridge.js [serial-path] [ws-port]
 *
 * Defaults:
 *   serial-path  /dev/cu.usbserial-0001
 *   ws-port      8089
 */

const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const SERIAL_PATH = process.argv[2] || '/dev/cu.usbserial-0001';
const WS_PORT = Number(process.argv[3]) || 8089;
const BAUD = 921600;

// ── Serial ──────────────────────────────────────────────────────

let serial;
let parser;

function openSerial() {
  serial = new SerialPort({ path: SERIAL_PATH, baudRate: BAUD, autoOpen: false });
  parser = serial.pipe(new ReadlineParser({ delimiter: '\n' }));

  serial.on('error', (err) => {
    console.error(`[serial] ${err.message}`);
    setTimeout(openSerial, 3000);
  });

  serial.on('close', () => {
    console.log('[serial] closed — retrying in 3 s');
    setTimeout(openSerial, 3000);
  });

  parser.on('data', (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) return; // skip stray log text
    broadcast(trimmed);
  });

  serial.open((err) => {
    if (err) {
      console.error(`[serial] can't open ${SERIAL_PATH}: ${err.message}`);
      setTimeout(openSerial, 3000);
    } else {
      console.log(`[serial] ${SERIAL_PATH} @ ${BAUD} baud`);
    }
  });
}

// ── WebSocket ───────────────────────────────────────────────────

const server = createServer();
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[ws] client connected (${clients.size} total)`);
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[ws] client disconnected (${clients.size} total)`);
  });
});

function broadcast(data) {
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(data);
  }
}

server.listen(WS_PORT, () => {
  console.log(`[ws] listening on ws://localhost:${WS_PORT}`);
  openSerial();
});

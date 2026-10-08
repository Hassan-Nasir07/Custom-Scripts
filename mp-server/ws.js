// A minimal RFC 6455 WebSocket server side, with no npm dependencies: npm is unreliable
// behind the office's TLS-inspecting proxy, and Node 22 ships a WebSocket client only.
//
//   const { upgrade } = require('./ws');
//   server.on('upgrade', (req, socket) => {
//       const ws = upgrade(req, socket);
//       if (!ws) return;
//       ws.on('message', text => ws.send(text));
//       ws.on('close', () => {});
//   });
//
// Text frames only (the protocol is JSON). Fragmented messages are reassembled, pings are
// answered, and a frame over MAX_FRAME closes the socket rather than buffering it.
const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_FRAME = 1 << 20;

function upgrade(req, socket) {
    const key = req.headers['sec-websocket-key'];
    if (!key || String(req.headers.upgrade).toLowerCase() !== 'websocket') {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return null;
    }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    socket.setNoDelay(true);
    return new Conn(socket, req);
}

class Conn extends EventEmitter {
    constructor(socket, req) {
        super();
        this.socket = socket;
        this.ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
        this.origin = req.headers.origin || '';
        this.open = true;
        this.buf = Buffer.alloc(0);
        this.parts = [];
        socket.on('data', d => this.onData(d));
        socket.on('close', () => this.done());
        socket.on('error', () => this.done());
    }

    send(text) {
        if (!this.open) return;
        const body = Buffer.from(String(text), 'utf8'), n = body.length;
        const head = n < 126 ? Buffer.from([0x81, n])
            : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255])
            : Buffer.concat([Buffer.from([0x81, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
        this.socket.write(Buffer.concat([head, body]));
    }

    close(code = 1000) {
        if (!this.open) return;
        const b = Buffer.from([0x88, 2, code >> 8, code & 255]);
        this.socket.end(b);
        this.done();
    }

    ping() { if (this.open) this.socket.write(Buffer.from([0x89, 0])); }

    done() {
        if (!this.open) return;
        this.open = false;
        this.socket.destroy();
        this.emit('close');
    }

    onData(d) {
        this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
        for (;;) {
            const b = this.buf;
            if (b.length < 2) return;
            const fin = (b[0] & 0x80) !== 0, op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
            let len = b[1] & 0x7f, at = 2;
            if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); at = 4; }
            else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); at = 10; }
            // Browsers always mask; an unmasked or oversized frame is not a browser's.
            if (!masked || len > MAX_FRAME) { this.close(1002); return; }
            if (b.length < at + 4 + len) return;
            const mask = b.subarray(at, at + 4), data = Buffer.from(b.subarray(at + 4, at + 4 + len));
            for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
            this.buf = b.subarray(at + 4 + len);
            if (op === 0x8) { this.close(); return; }
            if (op === 0x9) { this.socket.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }
            if (op === 0xa) { this.emit('pong'); continue; }
            if (op === 0x1 || op === 0x0) {
                this.parts.push(data);
                if (fin) {
                    const text = Buffer.concat(this.parts).toString('utf8');
                    this.parts = [];
                    this.emit('message', text);
                }
            }
        }
    }
}

module.exports = { upgrade };

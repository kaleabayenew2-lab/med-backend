// backend/tools/socket_test.js
const io = require('socket.io-client');
const url = process.env.URL || 'http://127.0.0.1:5000';
const socket = io(url, { transports: ['websocket'] });
socket.on('connect', () => console.log('test socket connected', socket.id));
socket.on('notification', (d) => console.log('GOT notification', d));
socket.on('chat_message', (d) => console.log('GOT chat_message', d));
socket.on('disconnect', () => console.log('test socket disconnected'));
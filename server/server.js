const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// In-memory store for rooms and peers
const rooms = {};

// Register a peer in a room
app.post('/register-peer', (req, res) => {
    const { roomId, peerId } = req.query;
    
    if (!rooms[roomId]) {
        rooms[roomId] = new Set();
    }
    rooms[roomId].add(peerId);
    
    console.log(`Peer ${peerId} registered in room ${roomId}`);
    res.json({ success: true, message: 'Peer registered successfully' });
});

// Get all peers in a room
app.get('/get-peers-in-room', (req, res) => {
    const { roomId } = req.query;
    
    if (!rooms[roomId]) {
        return res.json([]);
    }
    
    res.json(Array.from(rooms[roomId]));
});

// Remove a peer from a room
app.post('/remove-peer', (req, res) => {
    const { roomId, peerId } = req.query;
    
    if (rooms[roomId]) {
        rooms[roomId].delete(peerId);
        if (rooms[roomId].size === 0) {
            delete rooms[roomId];
        }
        console.log(`Peer ${peerId} removed from room ${roomId}`);
    }
    
    res.json({ success: true, message: 'Peer removed successfully' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
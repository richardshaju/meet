const PRE = "DELTA"
const SUF = "MEET"
var room_id;
var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
var local_stream;
var screenStream;
var peer = null;
var peers = {};
var screenSharing = false

function createRoom() {
    console.log("Creating Room")
    let room = document.getElementById("room-input").value;
    if (room == " " || room == "") {
        alert("Please enter room number")
        return;
    }
    room_id = PRE + room + SUF;
    peer = new Peer()
    peer.on('open', (id) => {
        console.log("Peer Connected with ID: ", id)
        hideModal()
        getUserMedia({ video: true, audio: true }, (stream) => {
            local_stream = stream;
            setLocalStream(local_stream)
            
            // Register this peer with the server
            registerPeer(room_id, id)
                .then(data => console.log(data))
                .catch(error => console.error('Error:', error));

            notify("Waiting for peers to join.")
            peer.on('call', handleIncomingCall)
        }, (err) => {
            console.log(err)
        })
    })
}

function joinRoom() {
    console.log("Joining Room")
    let room = document.getElementById("room-input").value;
    if (room == " " || room == "") {
        alert("Please enter room number")
        return;
    }
    room_id = PRE + room + SUF;
    hideModal()
    peer = new Peer()
    peer.on('open', (id) => {
        console.log("Connected with Id: " + id)
        getUserMedia({ video: true, audio: true }, (stream) => {
            local_stream = stream;
            setLocalStream(local_stream)
            notify("Joining peers")
            
            // Register this peer with the server
            registerPeer(room_id, id)
                .then(() => {
                    // Connect to all peers in the room
                    connectToPeersInRoom(room_id, stream)
                })
                .catch(error => console.error('Error:', error));

            // Listen for incoming calls
            peer.on('call', handleIncomingCall)
        }, (err) => {
            console.log(err)
        })
    })
}

function connectToPeersInRoom(roomId, stream) {
    getPeersInRoom(roomId)
        .then(peerIds => {
            peerIds.forEach(peerId => {
                if (peerId !== peer.id) {  // Don't connect to yourself
                    let call = peer.call(peerId, stream);
                    call.on('stream', (remoteStream) => {
                        console.log("Received stream from peer:", peerId);
                        setRemoteStream(remoteStream, peerId);
                    });
                    peers[peerId] = call;
                }
            });
        })
        .catch(error => console.error('Error:', error));
}

function handleIncomingCall(call) {
    call.answer(local_stream);
    call.on('stream', (remoteStream) => {
        setRemoteStream(remoteStream, call.peer)
    });
    peers[call.peer] = call;
}

function setLocalStream(stream) {
    let video = document.getElementById("local-video");
    video.srcObject = stream;
    video.muted = true;
    video.addEventListener('loadedmetadata', () => {
        video.play().catch(error => {
            console.log("Local video play error:", error);
            // Implement retry logic here if needed
        });
    });
}

function setRemoteStream(stream, peerId) {
    let video = document.getElementById("remote-video-" + peerId);
    if (!video) {
        video = document.createElement("video");
        video.id = "remote-video-" + peerId;
        document.getElementById("remote-video").appendChild(video);
    }
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        playVideoWithRetry(video).catch(error => {
            console.log("Final play error:", error);
            // Handle the error (e.g., show a message to the user)
        });
    });
}
function playVideoWithRetry(video, maxRetries = 3, delay = 1000) {
    let attempts = 0;

    function attemptPlay() {
        attempts++;
        return video.play().catch(error => {
            if (attempts < maxRetries) {
                console.log(`Play attempt ${attempts} failed, retrying in ${delay}ms...`);
                return new Promise(resolve => setTimeout(resolve, delay)).then(attemptPlay);
            }
            throw error;
        });
    }

    return attemptPlay();
}

function hideModal() {
    document.getElementById("entry-modal").hidden = true
}

function notify(msg) {
    let notification = document.getElementById("notification")
    notification.innerHTML = msg
    notification.hidden = false
    setTimeout(() => {
        notification.hidden = true;
    }, 3000)
}

function startScreenShare() {
    if (screenSharing) {
        stopScreenSharing()
    }
    navigator.mediaDevices.getDisplayMedia({ video: true }).then((stream) => {
        screenStream = stream;
        let videoTrack = screenStream.getVideoTracks()[0];
        videoTrack.onended = () => {
            stopScreenSharing()
        }
        for (let peerId in peers) {
            let sender = peers[peerId].peerConnection.getSenders().find(function (s) {
                return s.track.kind == videoTrack.kind;
            })
            sender.replaceTrack(videoTrack)
        }
        screenSharing = true
    })
}

function stopScreenSharing() {
    if (!screenSharing) return;
    let videoTrack = local_stream.getVideoTracks()[0];
    for (let peerId in peers) {
        let sender = peers[peerId].peerConnection.getSenders().find(function (s) {
            return s.track.kind == videoTrack.kind;
        })
        sender.replaceTrack(videoTrack)
    }
    screenStream.getTracks().forEach(function (track) {
        track.stop();
    });
    screenSharing = false
}

function registerPeer(roomId, peerId) {
    return fetch(`https://meet-ew2r.onrender.com/register-peer?roomId=${roomId}&peerId=${peerId}`, {method: 'POST'})
        .then(response => response.json());
}

function getPeersInRoom(roomId) {
    return fetch(`https://meet-ew2r.onrender.com/get-peers-in-room?roomId=${roomId}`)
        .then(response => response.json());
}

function removePeer(roomId, peerId) {
    return fetch(`https://meet-ew2r.onrender.com/remove-peer?roomId=${roomId}&peerId=${peerId}`, {method: 'POST'})
        .then(response => response.json());
}

window.onbeforeunload = function() {
    if (peer && room_id) {
        removePeer(room_id, peer.id);
    }
};
import { RoomServiceClient } from 'livekit-server-sdk';
import 'dotenv/config';

function toHttpsUrl(raw) {
    const stripped = raw.replace(/^(wss?|https?):(\/\/)?/, '')
    return `https://${stripped}`
}

async function test() {
    try {
        const url = toHttpsUrl(process.env.LIVEKIT_URL);
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;

        console.log("Testing with URL:", url);

        const svc = new RoomServiceClient(url, apiKey, apiSecret);
        await svc.createRoom({
            name: "test-room",
            emptyTimeout: 10,
            maxParticipants: 10
        });

        console.log("Room created successfully!");
        
        const rooms = await svc.listRooms();
        console.log("Active rooms:", rooms.length);
    } catch(err) {
        console.error("LiveKit Error:", err);
    }
}
test();

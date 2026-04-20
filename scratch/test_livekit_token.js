const { AccessToken, TrackSource } = require('livekit-server-sdk');

try {
    const at = new AccessToken('api-key', 'api-secret', { identity: 'user-id' });
    
    // This replicates the logic in route.ts
    const baseGrants = {
        roomJoin: true,
        room: 'room-name',
        canPublish: true,
        canSubscribe: true,
        canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE]
    };
    
    console.log('Grants before adding:', baseGrants);
    at.addGrant(baseGrants);
    console.log('Grant added successfully');
    
    at.toJwt().then(jwt => {
        console.log('JWT generated successfully');
    }).catch(err => {
        console.error('JWT generation failed:', err);
    });
} catch (err) {
    console.error('Script failed:', err);
}

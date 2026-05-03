// PM2 Ecosystem — AIM Platform Worker + ngrok tunnel
// Start everything: pm2 start ecosystem.config.js
// Save for boot:   pm2 save
// Enable on boot:  pm2 startup

module.exports = {
    apps: [
        {
            name: 'aim-worker',
            script: 'python',
            args: '-m uvicorn main:app --host 0.0.0.0 --port 8000',
            cwd: 'C:\\Users\\mxz\\Desktop\\my website\\aim-platform\\worker',
            interpreter: 'none',
            watch: false,
            autorestart: true,
            restart_delay: 3000,       // wait 3s before restart
            max_restarts: 20,
            env: {
                PYTHONUNBUFFERED: '1',
            },
            error_file: 'C:\\Users\\mxz\\.pm2\\logs\\aim-worker-error.log',
            out_file:   'C:\\Users\\mxz\\.pm2\\logs\\aim-worker-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
        {
            name: 'aim-ngrok',
            script: 'C:\\Program Files\\WindowsApps\\ngrok.ngrok_3.39.1.0_x64__1g87z0zv29zzc\\ngrok.exe',
            args: 'http 8000 --domain=impart-trailside-outpour.ngrok-free.dev',
            interpreter: 'none',
            watch: false,
            autorestart: true,
            restart_delay: 5000,
            max_restarts: 20,
            error_file: 'C:\\Users\\mxz\\.pm2\\logs\\aim-ngrok-error.log',
            out_file:   'C:\\Users\\mxz\\.pm2\\logs\\aim-ngrok-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
    ],
}

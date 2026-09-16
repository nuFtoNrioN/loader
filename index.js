const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();

const SECRET_SCRIPT_URL = process.env.SECRET_SCRIPT_URL;
const SECRET_KEY = process.env.SECRET_KEY;

app.get('/loader', async (req, res) => {
    const userAgent = req.headers['user-agent'] || '';
    const clientAuth = req.headers['authorization'];
    const clientTime = req.headers['x-timestamp'];

    const isBrowser = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari');

    let isValid = false;
    if (clientAuth && clientTime) {
        const currentTime = Math.floor(Date.now() / 1000);
        const reqTime = parseInt(clientTime, 10);

        if (Math.abs(currentTime - reqTime) <= 10) {
            const expectedAuth = crypto.createHash('md5').update(clientTime + SECRET_KEY).digest('hex');
            if (clientAuth === expectedAuth) {
                isValid = true;
            }
        }
    }

    if (isBrowser || !isValid) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(403).send(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <title>403 - Access Denied</title>
                <style>
                    body { background-color: #0b0c10; color: #fff; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    .card { background: #1f2833; padding: 40px; border-radius: 10px; border: 1px solid #ff4757; text-align: center; box-shadow: 0 0 20px rgba(0,0,0,0.8); }
                    h1 { color: #ff4757; font-size: 24px; margin-bottom: 10px; }
                    p { color: #c5a059; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>ACCESS DENIED</h1>
                    <p>Yêu cầu truy cập không hợp lệ hoặc đã hết hạn.</p>
                </div>
            </body>
            </html>
        `);
    }

    try {
        const response = await axios.get(SECRET_SCRIPT_URL);
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(response.data);
    } catch (error) {
        return res.status(500).send('print("Lỗi Server!")');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

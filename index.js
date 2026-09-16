const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
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
        const reqTime = parseInt(clientTime);

        if (Math.abs(currentTime - reqTime) <= 10) {
            const expectedAuth = crypto.createHash('md5').update(clientTime + SECRET_KEY).digest('hex');
            if (clientAuth === expectedAuth) {
                isValid = true;
            }
        }
    }

    if (isBrowser || !isValid) {
        return res.status(403).sendFile(path.join(__dirname, '403.html'));
    }

    try {
        const response = await axios.get(SECRET_SCRIPT_URL);
        res.setHeader('Content-Type', 'text/plain');
        return res.send(response.data);
    } catch (error) {
        return res.status(500).send('print("Server Error!")');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

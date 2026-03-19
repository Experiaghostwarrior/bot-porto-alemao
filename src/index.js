const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
    // Handle webhook payload
    console.log('Received webhook:', req.body);
    res.status(200).send('Webhook received!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Groq API Integration

const axios = require('axios');

const GROQ_API_URL = 'https://example.com/groq'; // Replace with actual URL

async function fetchData(query) {
    try {
        const response = await axios.post(GROQ_API_URL, { query });
        return response.data;
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}

module.exports = { fetchData };
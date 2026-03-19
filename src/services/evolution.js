// integration for Evolution API

const axios = require('axios');

const EVOLUTION_API_URL = 'https://api.example.com/evolution'; // Replace with actual API URL

const getEvolutionData = async (id) => {
    try {
        const response = await axios.get(`${EVOLUTION_API_URL}/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching evolution data:', error);
        throw error;
    }
};

module.exports = {
    getEvolutionData,
};
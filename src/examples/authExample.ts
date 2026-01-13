import { TokenManager, convertXmlToJsonWithAuth, AuthConfig } from '../utils/xmlToJsonConverter';

// Postman environment variables simulation
const config: AuthConfig = {
  apiKey: '{{API_KEY}}',
  baseUrl: 'https://api.example.com'
};

const xmlData = `<user id="123"><name>Muthu</name><email>muthu@example.com</email></user>`;

async function processWithAuth() {
  try {
    const jsonResult = await convertXmlToJsonWithAuth(xmlData, config);
    console.log('JSON:', jsonResult);
    console.log('Token:', TokenManager.getToken());
  } catch (error) {
    console.error('Error:', error);
  }
}

function setExistingToken() {
  TokenManager.setToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
}

export { processWithAuth, setExistingToken };
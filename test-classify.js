const axios = require('axios');

async function testClassification() {
  try {
    const response = await axios.post('http://localhost:3000/category/classify', {
      desc: '000000038313 HEAD OFFICE BRANCH -IBTC PLACE WEB PURCHASE @Netflixcom LAGOS NG'
    }, {
      headers: {
        'Content-Type': 'application/json',
        // You may need to add authorization header if required
        // 'Authorization': 'Bearer YOUR_JWT_TOKEN'
      }
    });

    console.log('Classification result:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else {
      console.error('Network Error:', error.message);
    }
  }
}

testClassification();
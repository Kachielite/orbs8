import axios from 'axios';
import { envConstants } from '../constants/env.secrets';

export const currencyConverter = async (
  from: string,
  to: string,
  amount: number,
): Promise<number> => {
  const url = `https://api.exchangerate.host/convert?access_key=${envConstants.EXCHANGE_RATE_API_KEY}&from=${from}&to=${to}&amount=${amount}`;
  try {
    const response = await axios.get(url);
    return  response.data.result as number;
  } catch (error) {
    console.error('Error fetching currency rate:', error);
    throw error;
  }
};
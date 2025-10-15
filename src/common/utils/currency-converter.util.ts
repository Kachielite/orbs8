import axios from 'axios';
import { envConstants } from '../constants/env.secrets';
import logger from './logger/logger';
import { Conversion } from '../../account/interfaces/conversion.interface';

export const currencyConverter = async (
  from: string,
  to: string,
  amount: number,
): Promise<Conversion> => {
  const url = `https://api.exchangerate.host/convert?access_key=${envConstants.EXCHANGE_RATE_API_KEY}&from=${from}&to=${to}&amount=${amount}`;
  try {
    const response = await axios.get(url);
    return {
      rate: response.data.info.quote as number,
      result: response.data.result as number,
      exchange: `${response.data.query.from}${response.data.query.to}`,
    } as Conversion;
  } catch (error) {
    logger.error('Error fetching currency rate:', error);
    throw error;
  }
};

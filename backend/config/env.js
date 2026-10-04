import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend/.env first, then fall back to a project-root .env.
// dotenv never overrides variables that are already set, so the first match wins.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const REQUIRED_VARS = ['MONGO_URI', 'JWT_SECRET'];

export const assertRequiredEnv = () => {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Copy backend/.env.example to backend/.env and fill in the values.');
    process.exit(1);
  }
};

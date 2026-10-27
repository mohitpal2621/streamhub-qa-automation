import { createApp } from './app';

const port = Number(process.env.API_PORT ?? 3000);

createApp({ logRequests: true }).listen(port, () => {
  console.log(`Streamhub catalogue API listening on port ${port} (base path /api/v1)`);
});

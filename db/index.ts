import { env } from 'cloudflare:workers';
export function getDb() {
  if (!env.DB) throw Error('评测数据库暂不可用');
  return env.DB;
}

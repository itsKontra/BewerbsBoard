import type { EventContext } from './_middleware';
import { jsonResponse } from './utils';

export async function onRequestGet(context: EventContext) {
  const user = context.data.adminUser || 'admin@feuerwehr.at';
  return jsonResponse({
    user,
    authMode: 'proxy',
    logoutUrl: '/oauth2/sign_out?rd=/admin',
  });
}

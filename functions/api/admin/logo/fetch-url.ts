import { jsonResponse, jsonError, saveCustomLogoToEnv, logAudit, type EventContext } from '../utils';
import { fetchAndProcessRemoteLogo } from '../../../../shared/transport/logo-transfer';

export async function onRequestPost(context: EventContext) {
  try {
    const body = (await context.request.json().catch(() => null)) as { url?: string } | null;
    if (!body || typeof body.url !== 'string' || !body.url.trim()) {
      return jsonError('URL ist erforderlich.', 400);
    }

    const processed = await fetchAndProcessRemoteLogo(body.url);
    if (!processed.success) {
      return jsonError(processed.error, 400);
    }

    const timestamp = Date.now();
    const logoUrl = `/api/public/logo?v=${timestamp}`;
    const storedLogo = {
      mimeType: processed.mimeType,
      base64Data: processed.base64Data,
      updatedAt: timestamp,
    };

    const adminUser = context.data?.adminUser || 'system';
    await saveCustomLogoToEnv(
      context.env,
      storedLogo,
      logoUrl,
      adminUser,
      {
        action: 'FETCH_CUSTOM_LOGO',
        operation: 'FETCH_URL',
        sourceUrl: body.url,
        mimeType: processed.mimeType,
        logoUrl,
      },
      logAudit
    );

    return jsonResponse({ success: true, logoUrl });
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}


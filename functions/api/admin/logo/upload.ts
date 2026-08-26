import { jsonResponse, jsonError, saveCustomLogoToEnv, logAudit, type EventContext } from '../utils';
import { extractImageBytesFromRequest } from '../../../../shared/transport/logo-transfer';
import { validateAndProcessLogo } from '../../../../shared/domain/tv-presentation';

export async function onRequestPost(context: EventContext) {
  try {
    const extracted = await extractImageBytesFromRequest(context.request);
    if (extracted.error || !extracted.bytes) {
      return jsonError(extracted.error || 'Fehler beim Lesen der Bilddaten.', 400);
    }

    const processed = validateAndProcessLogo(extracted.bytes, extracted.declaredMime);
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
        action: 'UPLOAD_CUSTOM_LOGO',
        operation: 'UPLOAD',
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


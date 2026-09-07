import { resolve } from 'node:path';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { KeeriConnector } from './connector';
import { ThreeDImportBatches } from './import-batches';
import { ThreeDService } from './service';
import { LocalArtifactStorage } from './storage';

export const keeriConfigured = !!(env.KEERI_3D_API_URL && env.KEERI_3D_TOKEN && env.KEERI_3D_TENANT_ID);
const connector = keeriConfigured ? new KeeriConnector({ baseUrl: env.KEERI_3D_API_URL!, token: env.KEERI_3D_TOKEN!, tenantId: env.KEERI_3D_TENANT_ID!, referenceOrigins: env.KEERI_3D_REFERENCE_ORIGINS.split(',').map(s => s.trim()).filter(Boolean) }) : undefined;
export const threeDService = new ThreeDService(prisma, new LocalArtifactStorage(env.THREE_D_STORAGE_DIR || resolve(process.cwd(), 'var/three-d')), connector);
export const threeDImportBatches = new ThreeDImportBatches(prisma, threeDService);

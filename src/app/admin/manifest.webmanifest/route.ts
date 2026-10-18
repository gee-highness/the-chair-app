import { adminManifest, manifestResponse } from '@/lib/manifests';

export const GET = () => manifestResponse(adminManifest());

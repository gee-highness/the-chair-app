import { manifestResponse, rootManifest } from '@/lib/manifests';

export const GET = () => manifestResponse(rootManifest());

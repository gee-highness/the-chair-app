import { GuideView } from '@/components/guide/GuideView';
import { guideById } from '@/lib/guide/guides';

export default function AdminGuidePage() {
  return <GuideView guides={[guideById('platform')!]} />;
}

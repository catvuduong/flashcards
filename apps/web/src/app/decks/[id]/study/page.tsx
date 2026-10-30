import { StudySession } from '@/components/study-session';

// The deck id is only known per request, so render on demand instead of prerendering.
export const instant = false;

export default async function Page({ params }: PageProps<'/decks/[id]/study'>) {
  const { id } = await params;
  return <StudySession id={id} />;
}

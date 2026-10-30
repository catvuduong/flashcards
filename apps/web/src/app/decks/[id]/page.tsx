import { DeckPage } from '@/components/deck-page';

// The deck id is only known per request, so render on demand instead of prerendering.
export const instant = false;

export default async function Page({ params }: PageProps<'/decks/[id]'>) {
  const { id } = await params;
  return <DeckPage id={id} />;
}

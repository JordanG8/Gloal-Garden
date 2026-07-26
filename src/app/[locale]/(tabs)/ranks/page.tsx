import { redirect } from 'next/navigation';
import { isLocale } from '@/i18n';

/**
 * The global leaderboard is gone; ranking is per-community now.
 *
 * "Top gardeners in Givat Ada" is both more motivating and more geographically
 * honest than a worldwide list nobody can place themselves in — so this route
 * forwards to the community feed, where the nearby zones (and their
 * leaderboards) are one tap away. Kept as a redirect rather than deleted
 * because the tab has been in the app long enough to be bookmarked.
 */
export default async function RanksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  redirect(`/${isLocale(raw) ? raw : 'en'}/community`);
}

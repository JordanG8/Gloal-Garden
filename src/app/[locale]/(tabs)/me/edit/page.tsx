import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireUserId } from '@/lib/auth-helpers';
import { getDict, isLocale, type Locale } from '@/i18n';
import { ProfileEditForm } from '@/components/profile/profile-edit-form';
import { BackButton } from '@/components/plant/back-button';

async function EditContent({ locale }: { locale: Locale }) {
  const userId = await requireUserId();
  if (!userId) redirect(`/${locale}/welcome`);

  const [row] = await db
    .select({
      displayName: users.displayName,
      bio: users.bio,
      location: users.location,
      avatar: users.avatar,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) redirect(`/${locale}/welcome`);

  return (
    <ProfileEditForm
      initial={{
        displayName: row.displayName,
        bio: row.bio ?? '',
        location: row.location ?? '',
        avatar: row.avatar ?? '',
      }}
    />
  );
}

export default async function EditProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const dict = getDict(locale);

  return (
    <div className="flex-1 px-5 pb-32 pt-[max(env(safe-area-inset-top),56px)]">
      <div className="flex items-center gap-3.5 pb-4">
        <BackButton locale={locale} tone="page" inline />
        <h1 className="animate-rise font-display text-[34px] font-bold uppercase leading-none text-ink">
          {dict.profile.editProfile}
        </h1>
      </div>
      <div className="mt-5">
        <Suspense
          fallback={
            <div className="flex flex-col gap-4">
              <div className="skeleton mx-auto h-[104px] w-[104px] rounded-full" />
              <div className="skeleton h-14 rounded-2xl" />
              <div className="skeleton h-24 rounded-2xl" />
              <div className="skeleton h-14 rounded-2xl" />
            </div>
          }
        >
          <EditContent locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}

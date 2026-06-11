"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserCheck, Heart } from "lucide-react";
import { toggleFollow, toggleAdoption } from "@/lib/social-actions";

export function FollowButton({
  targetId,
  initialFollowing,
  signedIn,
}: {
  targetId: number;
  initialFollowing: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    startTransition(async () => {
      const result = await toggleFollow(targetId);
      if (result.ok && result.following !== undefined) {
        setFollowing(result.following);
        router.refresh();
      }
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition disabled:opacity-60 ${
        following
          ? "bg-white/15 text-white border border-white/40 hover:bg-white/25"
          : "bg-white text-primary hover:bg-white/90"
      }`}
    >
      {following ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
      {following ? "Following" : "Follow"}
    </button>
  );
}

export function AdoptButton({
  plantId,
  initialAdopted,
  signedIn,
}: {
  plantId: number;
  initialAdopted: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [adopted, setAdopted] = useState(initialAdopted);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    startTransition(async () => {
      const result = await toggleAdoption(plantId);
      if (result.ok && result.adopted !== undefined) {
        setAdopted(result.adopted);
        router.refresh();
      }
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition disabled:opacity-60 border ${
        adopted
          ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
          : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
      }`}
    >
      <Heart className={`w-4 h-4 ${adopted ? "fill-current" : ""}`} />
      {adopted ? "Caretaker" : "Adopt this plant"}
    </button>
  );
}

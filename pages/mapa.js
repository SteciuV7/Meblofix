import { ROLE } from "@/lib/constants";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function LegacyMapaRedirect() {
  const router = useRouter();
  const { profile, loading } = useCurrentProfile();

  useEffect(() => {
    if (loading) return;

    if (!profile) {
      router.replace("/login");
      return;
    }

    router.replace(profile.role === ROLE.ADMIN ? "/trasy/nowa" : "/dashboard");
  }, [loading, profile, router]);

  return null;
}

import { loadCurrentProfile } from "@/lib/client-auth";
import { useEffect, useState } from "react";

export function useCurrentProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        const current = await loadCurrentProfile();
        if (mounted) {
          setProfile(current);
        }
      } catch (err) {
        if (mounted) {
          setError(err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    profile,
    loading,
    error,
  };
}

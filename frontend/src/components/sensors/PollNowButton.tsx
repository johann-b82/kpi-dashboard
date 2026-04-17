import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { pollSensorsNow, type PollNowResult } from "@/lib/api";
import { sensorKeys } from "@/lib/queryKeys";

/**
 * PollNowButton — SEN-FE-07. Blocks up to 30 s while the backend runs an
 * on-demand SNMP poll. On success, invalidates every `sensorKeys.*` query so
 * cards and charts refetch within the same tick.
 *
 * D-13 — 30 s client-side Promise.race timeout mirrors the backend's
 * asyncio.wait_for(timeout=30); on timeout, we show the dedicated timeout
 * toast (not the generic failure one) so the user knows the request never
 * reached the server.
 */

const POLL_TIMEOUT_MS = 30_000;
const TIMEOUT_SENTINEL = "timeout";

function pollWithTimeout(): Promise<PollNowResult> {
  return Promise.race<PollNowResult>([
    pollSensorsNow(),
    new Promise<PollNowResult>((_, reject) =>
      setTimeout(() => reject(new Error(TIMEOUT_SENTINEL)), POLL_TIMEOUT_MS),
    ),
  ]);
}

export function PollNowButton() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: pollWithTimeout,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: sensorKeys.all });
      toast.success(
        t("sensors.poll.success", { count: res.sensors_polled }),
      );
    },
    onError: (err: unknown) => {
      const isTimeout =
        err instanceof Error && err.message === TIMEOUT_SENTINEL;
      toast.error(
        isTimeout ? t("sensors.poll.timeout") : t("sensors.poll.failure"),
      );
    },
  });

  const label = mutation.isPending
    ? t("sensors.poll.refreshing")
    : t("sensors.poll.now");

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="inline-flex items-center justify-center rounded-md h-9 px-4 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      aria-busy={mutation.isPending}
    >
      {label}
    </button>
  );
}

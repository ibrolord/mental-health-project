export type LaunchReadiness = {
  contentReady: boolean;
  fallbackReady: boolean;
  layoutReady: boolean;
  markReady: boolean;
  routeReady: boolean;
};

export function isLaunchReady({
  contentReady,
  fallbackReady,
  layoutReady,
  markReady,
  routeReady,
}: LaunchReadiness): boolean {
  return contentReady && layoutReady && markReady && (routeReady || fallbackReady);
}

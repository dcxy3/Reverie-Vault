import React from "react";

export function isRemoteResource(source?: string | null) {
  return Boolean(source && /^https?:\/\//i.test(source));
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = React.useState(() => navigator.onLine);

  React.useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return isOnline;
}

export function ResilientImage({ src, fallback, onError, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fallback: React.ReactNode }) {
  const isOnline = useOnlineStatus();
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => setFailed(false), [src, isOnline]);

  if (!src || failed || (!isOnline && isRemoteResource(src))) return <>{fallback}</>;
  return <img {...props} src={src} onError={(event) => { setFailed(true); onError?.(event); }} />;
}

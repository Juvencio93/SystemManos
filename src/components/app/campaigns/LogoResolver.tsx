import { useEffect, useState } from "react";
import { getPublicStorageUrl } from "@/lib/storage.functions";

export function LogoResolver({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (path.startsWith("http")) {
      setUrl(path);
      return;
    }
    void getPublicStorageUrl({ data: { bucket: "campaign-assets", path } }).then(setUrl);
  }, [path]);

  if (!url) return <div className="h-full w-full animate-pulse bg-muted" />;
  return (
    <img
      loading="lazy"
      decoding="async"
      src={url}
      alt="Preview"
      className="h-full w-full object-contain p-2"
      onError={(event) => {
        console.error("LogoResolver failed:", event);
        event.currentTarget.src = "";
      }}
    />
  );
}


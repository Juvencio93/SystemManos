import { useState, useEffect } from "react";
import { Download, FileText, Image as ImageIcon, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { getAttachmentSignedUrl } from "@/lib/storage.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ChatAttachmentProps {
  attachment: {
    id: string;
    file_path: string;
    file_name: string;
    file_size: number;
    mime_type: string;
  };
  isMe?: boolean;
}

export function ChatAttachment({ attachment, isMe }: ChatAttachmentProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadUrl = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log(`[ChatAttachment] Requesting signed URL for attachment: ${attachment.id}`);
        const result = await getAttachmentSignedUrl({
          data: {
            attachmentId: attachment.id,
          },
        });
        
        if (isMounted) {
          if (!result?.signedUrl) {
            throw new Error("Servidor não retornou uma URL válida.");
          }
          setUrl(result.signedUrl);
          setLoading(false);
        }
      } catch (err: any) {
        console.error(`[ChatAttachment] Failed to load attachment ${attachment.id}:`, {
          error: err.message || err,
          attachmentId: attachment.id
        });
        if (isMounted) {
          setError(err.message || "Não foi possível abrir este arquivo");
          setLoading(false);
        }
      }
    };
    loadUrl();
    return () => {
      isMounted = false;
    };
  }, [attachment.file_path, attachment.id, retryCount]);

  const isImage = attachment.mime_type.startsWith("image/");
  const isPdf = attachment.mime_type === "application/pdf";
  const fileSizeStr = (attachment.file_size / 1024).toFixed(1) + " KB";

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2 bg-black/10 rounded-lg border border-white/5 mt-2 min-w-[180px]">
        <Loader2 className="size-4 animate-spin opacity-50" />
        <span className="text-[10px] opacity-70">Carregando arquivo...</span>
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="flex flex-col gap-2 p-3 bg-red-500/10 rounded-lg border border-red-500/20 mt-2 min-w-[200px]">
        <div className="flex items-center gap-2 text-red-400">
          <FileText className="size-4 opacity-70" />
          <span className="text-[10px] font-medium">Não foi possível abrir este arquivo</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setRetryCount(prev => prev + 1)}
          className="h-7 text-[9px] w-fit gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/20"
        >
          <RefreshCw className="size-3" /> Tentar novamente
        </Button>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="mt-2 group relative">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-lg border border-white/10 bg-black/20 transition-all hover:border-primary/50"
        >
          <img
            src={url}
            alt={attachment.file_name}
            className="max-h-60 max-w-full object-contain mx-auto"
            onError={() => setError("Erro ao renderizar imagem")}
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
             <ExternalLink className="size-6 text-white" />
          </div>
        </a>
        <div className="flex items-center justify-between mt-1 px-1">
          <span className="text-[9px] opacity-50 truncate max-w-[150px]">{attachment.file_name}</span>
          <a href={url} download={attachment.file_name} className="text-[9px] text-primary hover:underline flex items-center gap-1">
            <Download className="size-2.5" /> Baixar
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "mt-2 flex items-center gap-3 p-3 rounded-xl border transition-all",
      isMe ? "bg-black/20 border-white/10 hover:bg-black/30" : "bg-white/5 border-white/10 hover:bg-white/10"
    )}>
      <div className={cn(
        "size-10 rounded-lg flex items-center justify-center shrink-0",
        isPdf ? "bg-red-500/20 text-red-400" : "bg-primary/20 text-primary"
      )}>
        {isPdf ? <FileText className="size-6" /> : <ImageIcon className="size-6" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate text-white leading-tight">{attachment.file_name}</p>
        <p className="text-[10px] opacity-50 mt-0.5">{fileSizeStr}</p>
      </div>
      <div className="flex items-center gap-1">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
          title="Abrir arquivo"
        >
          <ExternalLink className="size-4" />
        </a>
        <a
          href={url}
          download={attachment.file_name}
          className="size-8 rounded-lg bg-white/5 text-white/70 flex items-center justify-center hover:bg-white/10 transition-colors"
          title="Baixar arquivo"
        >
          <Download className="size-4" />
        </a>
      </div>
    </div>
  );
}


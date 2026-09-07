import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type ChatProfileAvatarProps = {
  name: string;
  imageUrl?: string | null;
  status?: string | null;
  className?: string;
};

const statusBorder: Record<string, string> = {
  online: "border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.35)]",
  away: "border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]",
  busy: "border-red-400 shadow-[0_0_10px_rgba(248,113,113,0.3)]",
  offline: "border-slate-500",
};

export function ChatProfileAvatar({ name, imageUrl, status = "offline", className }: ChatProfileAvatarProps) {
  const initials = name.trim().slice(0, 2).toUpperCase() || "?";

  return (
    <Avatar
      className={cn(
        "rounded-md border-2 bg-slate-900 transition-colors duration-300",
        statusBorder[status ?? "offline"] || statusBorder["offline"],
        className,
      )}
    >
      {imageUrl ? <AvatarImage src={imageUrl} alt={`Foto de ${name}`} className="object-cover" /> : null}
      <AvatarFallback className="rounded-md bg-primary/20 text-[10px] font-bold uppercase text-primary">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

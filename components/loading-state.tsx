import { cn } from "@/lib/utils";
import { Loader2Icon } from "lucide-react";

interface Props {
  title: string;
  description: string;
  className?: string;
  fullPage?: boolean;
}

const LoadingState = ({ title, description, className, fullPage = false }: Props) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-8 text-center transition-all duration-500",
      fullPage ? "fixed inset-0 z-[100] bg-background/80 backdrop-blur-xl" : "min-h-[200px] w-full bg-transparent",
      className
    )}>
      <div className="relative group">
        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-0 group-hover:scale-150 transition-transform duration-1000 opacity-50" />
        <div className="relative p-4 rounded-3xl bg-card border border-border/50 shadow-2xl overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-pulse" />
          <div className="flex flex-col items-center gap-y-4 p-4 md:p-6">
            <div className="relative h-12 w-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
              <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
              <Loader2Icon className="size-5 text-primary opacity-20" />
            </div>
            <div className="flex flex-col gap-y-1 items-center">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">{title}</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{description}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingState;

"use client";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { NotificationCenter } from "@/modules/notifications/components/notification-center";
import {
  PanelLeftCloseIcon,
  PanelLeftIcon
} from "lucide-react";

const DashboardNavbar = () => {
  const { isMobile, state, toggleSidebar } = useSidebar();

  return (
    <>
      <nav className="sticky top-0 z-50 flex px-4 h-16 items-center bg-background/80 backdrop-blur-md border-b border-border/50 gap-x-2 shrink-0">
        <Button
          className="size-9 bg-transparent hover:bg-muted/50 border-border/50 transition-all rounded-xl"
          variant={"outline"}
          onClick={toggleSidebar}
        >
          {state === "collapsed" || isMobile ? (
            <PanelLeftIcon className="size-4 text-muted-foreground" />
          ) : (
            <PanelLeftCloseIcon className="size-4 text-muted-foreground" />
          )}
        </Button>
        <div className="ml-auto">
          <NotificationCenter />
        </div>
      </nav>
    </>
  );
};

export default DashboardNavbar;

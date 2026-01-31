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
      <nav className="flex px-4 gap-x-2 items-center bg-background py-3 border-b">
        <Button
          className="size-9"
          variant={"outline"}
          onClick={toggleSidebar}
        >
          {state === "collapsed" || isMobile ? (
            <PanelLeftIcon className="size-4" />
          ) : (
            <PanelLeftCloseIcon className="size-4" />
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

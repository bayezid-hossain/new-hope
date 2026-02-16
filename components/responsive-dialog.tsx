"use client";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from "./ui/drawer";

interface ResponsiveDialogProps {
  title: string;
  description: string;
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  persistent?: boolean;
}

import React from "react";

const ResponsiveDialog = ({
  children,
  description,
  onOpenChange,
  open,
  title,
  className,
  persistent = false,
}: ResponsiveDialogProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={true}>
        <DrawerContent
          className={className}
          onPointerDownOutside={(e) => persistent && e.preventDefault()}
          onEscapeKeyDown={(e) => persistent && e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>
              {description}
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 flex-1 flex flex-col min-h-0">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={className}
        onPointerDownOutside={(e) => persistent && e.preventDefault()}
        onEscapeKeyDown={(e) => persistent && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
};

export default ResponsiveDialog;

import { GeneratedAvatar } from "@/components/generated-avatar";
import {
  Avatar,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { authClient } from "@/lib/auth-client";
import {
  ChevronDownIcon,
  LogOutIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
const DashboardUserButton = () => {
  const { data, isPending } = authClient.useSession();
  const isMobile = useIsMobile();
  const router = useRouter();
  const onLogout = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in");
        },
      },
    });
  };
  if (isPending || !data?.user) {
    return null;
  }

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger className="rounded-lg gap-x-2 border border-border/10 p-3 w-full flex items-center justify-between bg-sidebar-accent/50 hover:bg-sidebar-accent/80 transition-colors overflow-hidden">
          {data.user.image ? (
            <Avatar>
              <AvatarImage src={data.user.image} />
            </Avatar>
          ) : (
            <GeneratedAvatar
              seed={data.user.name}
              variant="initials"
              className="size-9 mr-3"
            />
          )}
          <div className="flex flex-col gap-0.5 text-left overflow-hidden flex-1 min-w-0">
            <p className="text-sm truncate w-full">
              {data.user.name}
            </p>
            <p className="text-xs truncate w-full">
              {data.user.email}
            </p>
          </div>
          <ChevronDownIcon className="size-4 shrink-0" />
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{data.user.name}</DrawerTitle>
            <DrawerDescription>
              {data.user.email}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button
              onClick={onLogout}
              variant={"destructive"}
              className="font-bold uppercase tracking-wider h-11 shadow-sm"
            >
              <LogOutIcon className="size-4" />
              Logout
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-lg gap-x-2 border border-border/10 p-3 w-full flex items-center justify-between bg-sidebar-accent/50 hover:bg-sidebar-accent/80 transition-colors overflow-hidden">
        {data.user.image ? (
          <Avatar>
            <AvatarImage src={data.user.image} />
          </Avatar>
        ) : (
          <GeneratedAvatar
            seed={data.user.name}
            variant="initials"
            className="size-9 mr-3"
          />
        )}
        <div className="flex flex-col gap-0.5 text-left overflow-hidden flex-1 min-w-0">
          <p className="text-sm truncate w-full">
            {data.user.name}
          </p>
          <p className="text-xs truncate w-full">
            {data.user.email}
          </p>
        </div>
        <ChevronDownIcon className="size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="right"
        className="w-72"
      >
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <span className="font-medium truncate">
              {data.user.name}
            </span>
            <span className="text-sm font-normal text-muted-foreground truncate">
              {data.user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onLogout}
          className="cursor-pointer flex items-center justify-between text-destructive-foreground bg-destructive hover:bg-destructive/90 focus:bg-destructive/90 focus:text-destructive-foreground mt-1 font-bold rounded-lg transition-colors px-3 py-2"
        >
          Logout <LogOutIcon className="size-4" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DashboardUserButton;

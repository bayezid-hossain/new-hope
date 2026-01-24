// components/social-buttons.tsx
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import React from "react";
import {  FaGoogle } from "react-icons/fa";

interface SocialButtonsProps {
  setPending: (val: boolean) => void;
  setError: (val: string | null) => void;
  pending: boolean;
}

const SocialButtons: React.FC<SocialButtonsProps> = ({
  setPending,
  setError,
  pending,
}) => {
  const onSocial = (provider: "google" | "github") => {
    setError(null);
    setPending(true);

    authClient.signIn.social(
      {
        provider,
        callbackURL: "/",
      },
      {
        onSuccess: () => {
          setPending(false);
        },
        onError: ({ error }) => {
          setPending(false);
          setError(error.message);
        },
      }
    );
  };

  return (
    <div className="grid gap-4">
      <Button
        variant="outline"
        disabled={pending}
        type="button"
        onClick={() => onSocial("google")}
        className="w-full"
      >
        <FaGoogle /> oogle
      </Button>
      {/* <Button
        variant="outline"
        type="button"
        className="w-full"
        disabled={pending}
        onClick={() => onSocial("github")}
      >
        <FaGithub />
      </Button> */}
    </div>
  );
};

export default SocialButtons;

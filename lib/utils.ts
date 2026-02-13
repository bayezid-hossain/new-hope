import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Robustly copy text to clipboard with fallback for non-secure contexts or older browsers.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern API first
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error("Clipboard API failed, trying fallback:", err);
    }
  }

  // Fallback for non-secure contexts or if API fails
  const textArea = document.createElement("textarea");
  textArea.value = text;

  // Make the textarea invisible but part of the DOM
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  textArea.style.opacity = "0";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Fallback clipboard copy failed:", err);
    document.body.removeChild(textArea);
    return false;
  }
}

/**
 * Generate a unique ID, with fallback for non-secure contexts.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: simple random string + timestamp
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

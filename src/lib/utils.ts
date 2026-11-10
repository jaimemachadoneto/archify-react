import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Join class names, and let a later Tailwind class win over an earlier one.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

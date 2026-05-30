import "react";

declare module "react" {
  interface HTMLAttributes<T> {
    tr?: boolean | "false";
  }
}

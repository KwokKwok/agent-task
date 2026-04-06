import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ theme, ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-[14px] group-[.toaster]:border group-[.toaster]:border-[var(--toast-border)] group-[.toaster]:bg-[var(--toast-bg)] group-[.toaster]:text-[var(--toast-text)] group-[.toaster]:shadow-[var(--toast-shadow)]",
          title: "text-sm font-medium text-[var(--toast-text)]",
          description: "text-[13px] text-[var(--toast-muted)]",
          actionButton:
            "group-[.toast]:bg-[var(--toast-action-bg)] group-[.toast]:text-[var(--toast-action-text)]",
          cancelButton:
            "group-[.toast]:bg-[var(--toast-cancel-bg)] group-[.toast]:text-[var(--toast-cancel-text)]",
          closeButton:
            "group-[.toast]:border-[var(--toast-border)] group-[.toast]:bg-[var(--toast-bg)] group-[.toast]:text-[var(--toast-muted)]",
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--toast-bg)",
          "--normal-text": "var(--toast-text)",
          "--normal-border": "var(--toast-border)",
          "--border-radius": "14px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { ArrowLeft } from "lucide-react"
import { AnimatePresence, motion, MotionConfig, Variants } from "motion/react"

import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"

const TRANSITION = {
  type: "spring" as const,
  bounce: 0.1,
  duration: 0.4,
}

interface FloatingPanelContextType {
  isOpen: boolean
  openFloatingPanel: (rect: DOMRect) => void
  closeFloatingPanel: () => void
  uniqueId: string
  triggerRect: DOMRect | null
  title: string
  setTitle: (title: string) => void
}

const FloatingPanelContext = createContext<
  FloatingPanelContextType | undefined
>(undefined)

function useFloatingPanel() {
  const context = useContext(FloatingPanelContext)
  if (!context) {
    throw new Error(
      "useFloatingPanel must be used within a FloatingPanelProvider"
    )
  }
  return context
}

function useFloatingPanelLogic(externalOpen?: boolean, onOpenChange?: (open: boolean) => void) {
  const uniqueId = useId()
  const [internalOpen, setInternalOpen] = useState(false)
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null)
  const [title, setTitle] = useState("")

  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen

  const openFloatingPanel = useCallback((rect: DOMRect) => {
    setTriggerRect(rect)
    if (externalOpen === undefined) {
      setInternalOpen(true)
    } else if (onOpenChange) {
      onOpenChange(true)
    }
  }, [externalOpen, onOpenChange])

  const closeFloatingPanel = useCallback(() => {
    if (externalOpen === undefined) {
      setInternalOpen(false)
    } else if (onOpenChange) {
      onOpenChange(false)
    }
  }, [externalOpen, onOpenChange])

  return {
    isOpen,
    openFloatingPanel,
    closeFloatingPanel,
    uniqueId,
    triggerRect,
    title,
    setTitle,
  }
}

interface FloatingPanelRootProps {
  children: React.ReactNode
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export const FloatingPanelRoot = React.memo(function FloatingPanelRoot({
  children,
  className,
  open,
  onOpenChange,
}: FloatingPanelRootProps) {
  const floatingPanelLogic = useFloatingPanelLogic(open, onOpenChange)

  return (
    <FloatingPanelContext.Provider value={floatingPanelLogic}>
      <MotionConfig transition={TRANSITION}>
        <div className={cn("relative inline-flex", className)}>{children}</div>
      </MotionConfig>
    </FloatingPanelContext.Provider>
  )
})

interface FloatingPanelTriggerProps {
  children: React.ReactNode
  className?: string
  title?: string
  onClick?: () => void
}

export function FloatingPanelTrigger({
  children,
  className,
  title,
  onClick,
}: FloatingPanelTriggerProps) {
  const { isOpen, openFloatingPanel, uniqueId, setTitle } = useFloatingPanel()
  const triggerRef = useRef<HTMLButtonElement>(null)

  const handleClick = () => {
    if (triggerRef.current) {
      openFloatingPanel(triggerRef.current.getBoundingClientRect())
      if (title) setTitle(title)
      if (onClick) onClick()
    }
  }

  // children are the trigger content; title is used for the panel header
  const content = children || title

  return (
    <motion.button
      ref={triggerRef}
      className={cn(
        "inline-flex items-center gap-1 justify-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        className
      )}
      onClick={handleClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
    >
      {isOpen ? (
        <motion.span
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none inline-flex items-center gap-1"
        >
          {content}
        </motion.span>
      ) : (
        <motion.span layoutId={`fp-title-${uniqueId}`} layout="position" className="inline-flex items-center gap-1">
          {content}
        </motion.span>
      )}
    </motion.button>
  )
}

interface FloatingPanelContentProps {
  children: React.ReactNode
  className?: string
}

export function FloatingPanelContent({
  children,
  className,
}: FloatingPanelContentProps) {
  const { isOpen, closeFloatingPanel, uniqueId, triggerRect, title } =
    useFloatingPanel()
  const contentRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // Calculate safe position that stays within viewport
  useLayoutEffect(() => {
    if (!isOpen || !triggerRect || !contentRef.current) return
    const panelW = contentRef.current.offsetWidth
    const vw = window.innerWidth
    const left = Math.max(12, Math.min(triggerRect.left, vw - panelW - 12))
    const top = triggerRect.bottom + 8
    setPos({ left, top })
  }, [isOpen, triggerRect])

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        closeFloatingPanel()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen, closeFloatingPanel])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeFloatingPanel()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, closeFloatingPanel])

  const variants: Variants = {
    hidden: { opacity: 0, scale: 0.95, y: 6 },
    visible: { opacity: 1, scale: 1, y: 0 },
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
          />
          <motion.div
            ref={contentRef}
            className={cn(
              "fixed z-50 overflow-hidden rounded-xl bg-[var(--panel-bg)]/95 shadow-2xl backdrop-blur-md",
              className
            )}
            style={{
              borderRadius: 12,
              left: pos ? pos.left : triggerRect ? triggerRect.left : "50%",
              top: pos ? pos.top : triggerRect ? triggerRect.bottom + 8 : "50%",
              transformOrigin: "top left",
              visibility: pos ? "visible" : "hidden",
            }}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={variants}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`floating-panel-title-${uniqueId}`}
          >
            <div className="px-4 py-2.5">
              <motion.div
                layoutId={`fp-title-${uniqueId}`}
                layout="position"
                className="text-sm font-semibold text-[var(--text-main)]"
                id={`floating-panel-title-${uniqueId}`}
              >
                {title}
              </motion.div>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

interface FloatingPanelFormProps {
  children: React.ReactNode
  onSubmit?: (note: string) => void
  className?: string
}

export function FloatingPanelForm({
  children,
  onSubmit,
  className,
}: FloatingPanelFormProps) {
  const { closeFloatingPanel } = useFloatingPanel()
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(formRef.current || undefined)
    const note = formData.get('note') as string || ''
    onSubmit?.(note)
    closeFloatingPanel()
  }

  return (
    <form
      ref={formRef}
      className={cn("flex flex-col", className)}
      onSubmit={handleSubmit}
    >
      {children}
    </form>
  )
}

interface FloatingPanelBodyProps {
  children: React.ReactNode
  className?: string
}

export function FloatingPanelBody({
  children,
  className,
}: FloatingPanelBodyProps) {
  return (
    <div className={cn("px-4 py-2", className)}>
      {children}
    </div>
  )
}

interface FloatingPanelFooterProps {
  children: React.ReactNode
  className?: string
}

export function FloatingPanelFooter({
  children,
  className,
}: FloatingPanelFooterProps) {
  return (
    <div className={cn("flex items-center justify-between px-4 pb-3 pt-1", className)}>
      {children}
    </div>
  )
}

export function FloatingPanelCloseButton({ className }: { className?: string }) {
  const { closeFloatingPanel } = useFloatingPanel()

  return (
    <motion.button
      type="button"
      className={cn(
        "flex items-center justify-center rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]",
        className
      )}
      onClick={closeFloatingPanel}
      aria-label="返回"
      whileHover={{ x: -2 }}
      whileTap={{ scale: 0.9 }}
    >
      <ArrowLeft size={16} />
    </motion.button>
  )
}

interface FloatingPanelLabelProps {
  children: React.ReactNode
  htmlFor?: string
  className?: string
}

export function FloatingPanelLabel({
  children,
  htmlFor,
  className,
}: FloatingPanelLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1.5 block text-xs font-medium text-[var(--text-muted)]",
        className
      )}
    >
      {children}
    </label>
  )
}

interface FloatingPanelTextareaProps {
  id?: string
  className?: string
  placeholder?: string
}

export function FloatingPanelTextarea({
  id,
  className,
  placeholder,
}: FloatingPanelTextareaProps) {
  return (
    <Textarea
      id={id}
      name="note"
      autoFocus
      placeholder={placeholder}
      className={cn(
        "resize-none rounded-lg bg-[var(--surface-subtle)] p-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)]",
        className
      )}
    />
  )
}

export function FloatingPanelSubmitButton({ className }: { className?: string }) {
  return (
    <motion.button
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-lg border border-[var(--border-subtle)] px-3 text-xs font-medium text-[var(--text-soft)] hover:text-[var(--text-main)] hover:border-[var(--text-muted)] transition-colors",
        className
      )}
      type="submit"
      aria-label="确认"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
    >
      确认提交
    </motion.button>
  )
}

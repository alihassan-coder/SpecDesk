"use client";

import { useState, type FormEvent } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SidebarMenuAction, useSidebar } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { deleteChat, renameChat, TITLE_MAX, toastError, type RenamedChat } from "@/lib/chat-api";

interface ChatActionsProps {
  chat: { id: string; title: string };
  onRenamed: (chat: RenamedChat) => void;
  onDeleted: (id: string) => void;
}

/** The "…" menu on a recent plan in the sidebar: rename or delete it. */
export function ChatActions({ chat, onRenamed, onDeleted }: ChatActionsProps) {
  const { isMobile } = useSidebar();
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          {/* showOnHover hides it on md+ until hover/focus; on mobile it's always visible. */}
          <SidebarMenuAction showOnHover aria-label={`Actions for ${chat.title}`}>
            <MoreHorizontal />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={isMobile ? "bottom" : "right"} align={isMobile ? "end" : "start"} className="w-40">
          <DropdownMenuItem onSelect={() => setDialog("rename")}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameDialog
        chat={chat}
        open={dialog === "rename"}
        onOpenChange={(open) => setDialog(open ? "rename" : null)}
        onRenamed={onRenamed}
      />
      <DeleteDialog
        chat={chat}
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        onDeleted={onDeleted}
      />
    </>
  );
}

interface DialogProps {
  chat: { id: string; title: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RenameDialog({ chat, open, onOpenChange, onRenamed }: DialogProps & { onRenamed: ChatActionsProps["onRenamed"] }) {
  const [title, setTitle] = useState(chat.title);
  const [saving, setSaving] = useState(false);
  const trimmed = title.trim();
  const inputId = `rename-${chat.id}`;

  function changeOpen(next: boolean) {
    if (!next) setTitle(chat.title); // a cancelled edit doesn't linger for next time
    onOpenChange(next);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!trimmed || saving) return;
    if (trimmed === chat.title) return onOpenChange(false);
    setSaving(true);
    try {
      onRenamed(await renameChat(chat.id, trimmed));
      onOpenChange(false);
      toast.success("Plan renamed");
    } catch (err) {
      const { title: t, description } = toastError(err, "We couldn't rename this plan");
      toast.error(t, { description });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Rename plan</DialogTitle>
            <DialogDescription>Give this plan a name you&apos;ll recognise in the sidebar.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={inputId}>Name</FieldLabel>
            <Input
              id={inputId}
              value={title}
              maxLength={TITLE_MAX}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={!trimmed}
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!trimmed || saving}>
              {saving && <Spinner />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ chat, open, onOpenChange, onDeleted }: DialogProps & { onDeleted: ChatActionsProps["onDeleted"] }) {
  const [deleting, setDeleting] = useState(false);

  async function confirm() {
    setDeleting(true);
    try {
      await deleteChat(chat.id);
      onOpenChange(false);
      toast.success("Plan deleted", { description: chat.title });
      onDeleted(chat.id);
    } catch (err) {
      const { title, description } = toastError(err, "We couldn't delete this plan");
      toast.error(title, { description });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !deleting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this plan?</DialogTitle>
          <DialogDescription>This removes the chat, its plan and files. This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={deleting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={confirm} disabled={deleting}>
            {deleting && <Spinner />}
            Delete plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

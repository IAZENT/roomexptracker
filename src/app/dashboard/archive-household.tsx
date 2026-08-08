"use client";

import { useState, useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { archiveHousehold, type ArchiveActionState } from "./actions";

const initialState: ArchiveActionState = { error: null };

export function ArchiveHouseholdButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-4 text-destructive hover:text-destructive">
          <AlertTriangle className="mr-1.5 h-4 w-4" />
          Start new household
        </Button>
      </DialogTrigger>
      <DialogContent>
        <ArchiveConfirmForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ArchiveConfirmForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, action, pending] = useActionState(archiveHousehold, initialState);
  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted && !state.error) {
      window.location.reload();
    }
  }, [submitted, state.error]);

  // After successful archive
  if (submitted && !state.error) {
    return (
      <div className="rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
        Household archived. Refreshing...
      </div>
    );
  }

  // Step 2: Final confirmation
  if (confirmed) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>This action cannot be undone</DialogTitle>
          <DialogDescription>
            Your household and all its data will be archived. You can still view history, but no new expenses can be added.
          </DialogDescription>
        </DialogHeader>
        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setConfirmed(false)}>
            Cancel
          </Button>
          <form
            action={(formData) => {
              setSubmitted(true);
              action(formData);
            }}
          >
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Archiving..." : "Yes, archive it"}
            </Button>
          </form>
        </DialogFooter>
      </>
    );
  }

  // Step 1: Initial warning
  return (
    <>
      <DialogHeader>
        <DialogTitle>Archive current household?</DialogTitle>
        <DialogDescription>
          This will archive your current household. You can still view its history, but you won&apos;t be able to add expenses.
          You can then create or join a new household.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost" size="sm" onClick={onSuccess}>
          Cancel
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirmed(true)}>
          Start new household
        </Button>
      </DialogFooter>
    </>
  );
}

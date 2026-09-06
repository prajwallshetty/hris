"use client";

import { Ban, CheckCircle2, PlayCircle } from "lucide-react";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { Button } from "@/components/ui/button";
import { activateRental, cancelRental, closeRental } from "@/server/actions/equipment";

export function ActivateRentalButton({ rentalId }: { rentalId: string }) {
  return (
    <ConfirmActionButton
      trigger={
        <Button size="sm" variant="outline">
          <PlayCircle className="size-4" />
          Activate
        </Button>
      }
      title="Activate this rental?"
      description="Marks the equipment as physically handed over and the rental period as underway."
      confirmLabel="Activate"
      action={activateRental.bind(null, rentalId)}
      successMessage="Rental activated."
    />
  );
}

export function CancelRentalButton({ rentalId }: { rentalId: string }) {
  return (
    <ConfirmActionButton
      trigger={
        <Button size="sm" variant="outline">
          <Ban className="size-4" />
          Cancel
        </Button>
      }
      title="Cancel this rental?"
      description="The equipment becomes available again. This cannot be undone."
      confirmLabel="Cancel Rental"
      variant="destructive"
      action={cancelRental.bind(null, rentalId)}
      successMessage="Rental cancelled."
    />
  );
}

export function CloseRentalButton({ rentalId }: { rentalId: string }) {
  return (
    <ConfirmActionButton
      trigger={
        <Button size="sm" variant="outline">
          <CheckCircle2 className="size-4" />
          Close
        </Button>
      }
      title="Close this rental?"
      description="Marks the rental as fully reconciled. Charges and payments remain visible."
      confirmLabel="Close Rental"
      action={closeRental.bind(null, rentalId)}
      successMessage="Rental closed."
    />
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updatePaysFor, type Member } from "./actions";
import { Users } from "lucide-react";

export function PaysForSettings({
  householdId,
  members,
  role,
}: {
  householdId: string;
  members: Member[];
  role: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const handleEdit = (member: Member) => {
    setEditing(member.user_id);
    // Use existing pays_for if set, otherwise just self
    if (member.pays_for && member.pays_for.length > 0) {
      setSelected(member.pays_for);
    } else {
      setSelected([member.user_id]);
    }
  };

  const handleSave = async (userId: string) => {
    const paysFor = selected.length > 0 ? selected : null;
    const result = await updatePaysFor(householdId, userId, paysFor);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Pays-for updated");
      setEditing(null);
    }
  };

  const toggleMember = (userId: string) => {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  if (role !== "owner") return null;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Who pays for whom
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Set who covers whom in expense splits. E.g. if B1 pays for B2, their expenses split between them only.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {members.map((m) => {
            const isEditing = editing === m.user_id;
            return (
              <div key={m.user_id} className="rounded-lg bg-secondary/50 px-3 py-2">
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground">
                      Who does {m.full_name} pay for?
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {members.map((other) => (
                        <button
                          key={other.user_id}
                          onClick={() => toggleMember(other.user_id)}
                          className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                            selected.includes(other.user_id)
                              ? "bg-primary text-primary-foreground"
                              : "bg-background text-foreground border border-border hover:bg-secondary"
                          }`}
                        >
                          {other.full_name}
                          {other.user_id === m.user_id && " (self)"}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-1">
                      <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleSave(m.user_id)}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{m.full_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.pays_for && m.pays_for.length > 1
                          ? `Pays for: ${members
                              .filter((other) => m.pays_for!.includes(other.user_id))
                              .map((o) => o.user_id === m.user_id ? `${o.full_name} (self)` : o.full_name)
                              .join(", ")}`
                          : "Pays for self only"}
                      </span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(m)}>
                      Edit
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

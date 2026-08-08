"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Tags } from "lucide-react";
import {
  addCustomExpenseType,
  deleteCustomExpenseType,
  type CustomExpenseType,
} from "./actions";

export function CustomTypesSettings({
  types,
  householdId,
}: {
  types: CustomExpenseType[];
  householdId: string;
}) {
  const [newType, setNewType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newType.trim();
    if (!name) return;

    setAdding(true);
    setError(null);

    const result = await addCustomExpenseType(householdId, name);
    if (result.error) {
      setError(result.error);
    } else {
      setNewType("");
    }
    setAdding(false);
  };

  const handleDelete = async (typeId: string) => {
    await deleteCustomExpenseType(typeId);
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Tags className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Custom expense types</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          Add custom categories for your household&apos;s expenses (e.g. &quot;snacks&quot;, &quot;transport&quot;, &quot;internet&quot;).
        </p>

        {types.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {types.map((type) => (
              <Badge
                key={type.id}
                variant="secondary"
                className="gap-1 pr-1"
              >
                {type.name}
                <button
                  onClick={() => handleDelete(type.id)}
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            placeholder="New type name"
            value={newType}
            onChange={(e) => {
              setNewType(e.target.value);
              setError(null);
            }}
            className="flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!newType.trim() || adding}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}

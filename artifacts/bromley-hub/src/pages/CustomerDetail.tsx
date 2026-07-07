import { useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useAddPart,
  useUpdatePart,
  useDeletePart,
  getGetCustomerQueryKey,
  getListCustomersQueryKey,
  getGetDashboardQueryKey as getDashboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/StatusDot";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit2, Trash2, Plus, AlertTriangle, CheckCircle2, Clock, Upload, Package, Truck, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function CustomerDetail() {
  const [, params] = useRoute("/customers/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: customer, isLoading } = useGetCustomer(id, {
    query: { enabled: !!id, queryKey: getGetCustomerQueryKey(id) }
  });

  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const addPart = useAddPart();
  const updatePart = useUpdatePart();
  const deletePart = useDeletePart();

  const [newPartName, setNewPartName] = useState("");
  const [isAddingPart, setIsAddingPart] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getDashboardQueryKey() });
  };

  const handleAddPart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartName.trim()) return;

    addPart.mutate(
      { customerId: id, data: { name: newPartName, status: "waiting" } },
      {
        onSuccess: () => {
          setNewPartName("");
          setIsAddingPart(false);
          invalidateAll();
        }
      }
    );
  };

  const handleDeletePart = (partId: number) => {
    if (confirm("Remove this part?")) {
      deletePart.mutate({ id: partId }, { onSuccess: invalidateAll });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/import`, { method: "POST", body: formData });
      const result = await res.json();

      if (!res.ok) {
        toast({ title: "Import failed", description: result.error ?? "Unknown error", variant: "destructive" });
      } else {
        toast({
          title: "Import complete",
          description: `${result.partsCreated} new parts added, ${result.partsUpdated} updated, ${result.partsSkipped} unchanged.`,
        });
        invalidateAll();
      }
    } catch {
      toast({ title: "Import failed", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isLoading || !customer) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-8 w-24 bg-muted rounded"></div>
        <div className="h-32 bg-muted rounded-xl"></div>
        <div className="h-64 bg-muted rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      <Link href="/customers" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Customers
      </Link>

      {/* Readiness Banner */}
      {customer.status === "all_received" && customer.parts.length > 0 && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg p-4 flex items-center gap-4 text-green-800 dark:text-green-400 shadow-sm animate-in slide-in-from-top-4">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          <div>
            <h3 className="font-bold text-lg">ALL PARTS RECEIVED</h3>
            <p className="text-sm opacity-90">This job is ready for the technician.</p>
          </div>
        </div>
      )}

      {/* Header Card */}
      <Card className="border-t-4 border-t-primary shadow-md">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <StatusDot status={customer.status} className="h-4 w-4" />
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{customer.name}</h1>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Vehicle</div>
                  <div className="text-lg font-medium">
                    {customer.vehicleYear} {customer.vehicleMake} {customer.vehicleModel}
                    {!customer.vehicleYear && !customer.vehicleMake && <span className="text-muted-foreground italic text-sm">No vehicle assigned</span>}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">RO Number</div>
                  <div>
                    {customer.roNumber ? (
                      <Badge variant="secondary" className="font-mono text-sm px-2 py-1">{customer.roNumber}</Badge>
                    ) : (
                      <span className="text-muted-foreground italic text-sm">Not assigned</span>
                    )}
                  </div>
                </div>
              </div>

              {customer.notes && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Notes</div>
                  <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
                </div>
              )}
            </div>

            <div className="flex flex-row md:flex-col gap-2 shrink-0">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Edit2 className="mr-2 h-4 w-4" /> Edit Details
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="mr-2 h-4 w-4" /> Delete Job
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parts List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b pb-4">
          <CardTitle className="text-xl">Parts List</CardTitle>
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium px-3 py-1 rounded-full bg-secondary text-secondary-foreground">
              {customer.partsReceived} / {customer.partsTotal} Received
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {customer.parts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>No parts added to this job yet.</p>
              </div>
            ) : (
              customer.parts.map((part) => (
                <div key={part.id} data-testid={`part-row-${part.id}`} className="p-4 sm:p-6 flex flex-col gap-3 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-base">{part.name}</div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        {part.partNumber && (
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            <span className="font-mono">{part.partNumber}</span>
                          </span>
                        )}
                        {part.vendor && (
                          <span className="flex items-center gap-1">
                            <Truck className="h-3 w-3" />
                            {part.vendor}
                          </span>
                        )}
                        {part.dateOrdered && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            Ordered {part.dateOrdered}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Status Toggles */}
                      <div className="flex bg-secondary p-1 rounded-lg">
                        <button
                          data-testid={`status-received-${part.id}`}
                          onClick={() => updatePart.mutate({ id: part.id, data: { status: "received" } }, { onSuccess: invalidateAll })}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${
                            part.status === "received"
                              ? "bg-green-500 text-white shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {part.status === "received" && <CheckCircle2 className="h-4 w-4" />}
                          Received
                        </button>
                        <button
                          data-testid={`status-waiting-${part.id}`}
                          onClick={() => updatePart.mutate({ id: part.id, data: { status: "waiting" } }, { onSuccess: invalidateAll })}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${
                            part.status === "waiting"
                              ? "bg-yellow-400 text-yellow-950 shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {part.status === "waiting" && <Clock className="h-4 w-4" />}
                          Waiting
                        </button>
                        <button
                          data-testid={`status-backordered-${part.id}`}
                          onClick={() => updatePart.mutate({ id: part.id, data: { status: "backordered" } }, { onSuccess: invalidateAll })}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${
                            part.status === "backordered"
                              ? "bg-red-500 text-white shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {part.status === "backordered" && <AlertTriangle className="h-4 w-4" />}
                          B/O
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeletePart(part.id)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        title="Delete part"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 sm:p-6 bg-muted/10 border-t">
            {isAddingPart ? (
              <form onSubmit={handleAddPart} className="flex items-center gap-3">
                <Input
                  autoFocus
                  placeholder="Enter part name..."
                  value={newPartName}
                  onChange={(e) => setNewPartName(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={!newPartName.trim() || addPart.isPending}>
                  {addPart.isPending ? "Adding..." : "Save Part"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setIsAddingPart(false)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <Button
                onClick={() => setIsAddingPart(true)}
                variant="outline"
                className="w-full border-dashed border-2 py-6 text-muted-foreground hover:text-foreground hover:border-primary hover:bg-primary/5"
                data-testid="button-add-part"
              >
                <Plus className="mr-2 h-5 w-5" />
                Add Part to Job
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import from Spreadsheet */}
      <div className="flex items-center justify-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleImport}
          data-testid="input-import-file"
        />
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground gap-2"
          disabled={isImporting}
          onClick={() => fileInputRef.current?.click()}
          data-testid="button-import-spreadsheet"
        >
          <Upload className="h-4 w-4" />
          {isImporting ? "Importing..." : "Import from Spreadsheet (.xlsx)"}
        </Button>
      </div>
    </div>
  );
}
